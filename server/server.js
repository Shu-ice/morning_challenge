import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import environmentConfig from './config/environment.js';
import { logger } from './utils/logger.js';
import { performanceMonitor, startPerformanceMonitoring } from './middleware/performanceMiddleware.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { protect, admin } from './middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { securityHeaders, rateLimiter, sanitizeInput } from './middleware/securityMiddleware.js';

import User from './models/User.js';
import DailyProblemSet from './models/DailyProblemSet.js';
import Result from './models/Result.js';
import { generateProblems } from './utils/problemGenerator.js';
import { DifficultyRank } from './constants/difficultyRank.js';
import authRoutes from './routes/authRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import { generateProblems as generateProblemsUtil } from './utils/problemGenerator.js';
import rankingRoutes from './routes/rankingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { getHistory } from './controllers/problemController.js';
import challengeRoutes from './routes/challengeRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import counselingRoutes from './routes/counselingRoutes.js';

// --- dayjs プラグインの適用 (トップレベルで実行) ---
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.tz.setDefault("Asia/Tokyo");

// 環境設定から値を取得
const JWT_SECRET = environmentConfig.jwtSecret;
const JWT_EXPIRES_IN = environmentConfig.jwtExpiresIn;
const PORT = environmentConfig.port;
const FRONTEND_PORT = environmentConfig.frontendPort;
const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;

console.log('🔍 [DEBUG] サーバー起動開始');
logger.info(`🚀 サーバーがポート ${PORT} で起動準備中...`);
logger.info(`🔗 フロントエンドオリジン許可予定: ${FRONTEND_ORIGIN}`);
console.log('🔍 [DEBUG] 環境設定読み込み完了');

// ポート使用状況をチェックする関数

const JST_OFFSET = 9 * 60;
const problemGenerationLocks = new Map();

// --- ヘルパー関数定義 (initializeApp より前に定義) ---
const isChallengeTimeAllowed = () => {
    if (process.env.DISABLE_TIME_CHECK === 'true') {
    // logger.info('[Time Check] Skipped due to DISABLE_TIME_CHECK=true'); // 必要ならコメント解除
        return true;
    }

    const nowJST = dayjs().tz();
    const currentHour = nowJST.hour();
    const currentMinute = nowJST.minute();

    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = 5 * 60 + 15;
    const endTimeInMinutes = 7 * 60 + 15;

    const isAllowed = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    if (!isAllowed) {
        logger.warn(`[Time Check] Access denied. Current JST: ${nowJST.format('HH:mm')}. Allowed: 05:15 - 07:15`);
    }
    return isAllowed;
};

const getTodayDateStringJST = () => {
    return dayjs().tz().format('YYYY-MM-DD');
};

const generateProblemsForNextDay = async () => {
  try {
    const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
    logger.info(`[自動生成] ${tomorrow}の問題セットを生成します...`);
    
    // 全難易度の問題を生成
    for (const difficulty of Object.values(DifficultyRank)) {
      // 既に存在するかチェック
      const existingSet = await DailyProblemSet.findOne({ date: tomorrow, difficulty });
      
      if (existingSet) {
        logger.info(`[自動生成] ${tomorrow}の${difficulty}難易度の問題セットは既に存在します。スキップします。`);
        continue;
      }
      
      logger.info(`[自動生成] ${tomorrow}の${difficulty}難易度の問題を生成します...`);
      
      try {
        // 決定論的に問題を生成（日付と難易度から一貫したシード値を生成）
        const seed = `${tomorrow}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const problems = generateProblems(difficulty, 10, seed);
        
        if (!problems || problems.length === 0) {
          logger.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成に失敗しました。`);
          continue;
        }
        
        // 問題セットを保存
        const newProblemSet = new DailyProblemSet({
          date: tomorrow,
          difficulty,
          problems: problems.map(p => ({
            id: p.id,
            question: p.question,
            correctAnswer: p.answer,
            options: p.options
          }))
        });
        
        await newProblemSet.save();
        logger.info(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成完了 (${problems.length}問)`);
      } catch (error) {
        logger.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成中にエラー:`, error);
      }
    }
    
    logger.info(`[自動生成] ${tomorrow}の全難易度の問題生成が完了しました。`);
  } catch (error) {
    logger.error('[自動生成] 翌日問題の生成中にエラー:', error);
  }
};

const scheduleNextGeneration = () => {
  const now = dayjs().tz();
const targetHour = 12;
  let nextRun = now.hour(targetHour).minute(0).second(0);
  if (now.hour() >= targetHour) {
    nextRun = nextRun.add(1, 'day');
  }
  const timeToNextRun = nextRun.diff(now);
  logger.info(`[スケジューラ] 次回の問題自動生成は ${nextRun.format('YYYY-MM-DD HH:mm:ss')} に実行されます (${Math.round(timeToNextRun / (1000 * 60))}分後)`);
  setTimeout(() => {
    logger.info('[スケジューラ] 定期実行: 翌日問題の自動生成を開始します');
    generateProblemsForNextDay().finally(() => {
      scheduleNextGeneration();
    });
  }, timeToNextRun);
};

const createDefaultAdminUser = async () => {
    try {
        const { getOrGeneratePassword, maskSensitive } = await import('./utils/securityUtils.js');
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        
        // 🔒 セキュリティ強化: 環境変数または安全な自動生成パスワードを使用
        const passwordInfo = getOrGeneratePassword('ADMIN_DEFAULT_PASSWORD', 16);

        // Mongoose の User モデルが正しくインポート・初期化されているか確認
        if (!User || typeof User.findOne !== 'function') {
            logger.error('[Init] CRITICAL: User model is not available in createDefaultAdminUser.');
            return;
        }
        
        let existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            logger.info(`[Init] Admin user '${adminEmail}' already exists. Attempting to reset password.`);
            if (!existingAdmin.isAdmin) {
                logger.info(`[Init] Granting admin rights to '${adminEmail}'.`);
                existingAdmin.isAdmin = true;
            }

            // パスワードを強制的にリセット
            // pre('save') フックが正しく動作するため、ここで直接ハッシュ化せず、平文をセットする
            existingAdmin.password = passwordInfo.password; 
            
            try {
                await existingAdmin.save(); // ここで pre-save フックが実行されハッシュ化される
                logger.info(`[Init] Admin user '${adminEmail}' password reset and saved.`);

                // セキュリティ情報のログ出力
                if (passwordInfo.isGenerated) {
                    logger.warn(`🔑 管理者パスワードを自動生成しました: ${maskSensitive(passwordInfo.password, 6)}`);
                    logger.warn(`📝 完全なパスワード: ${passwordInfo.password}`);
                    logger.warn(`⚠️ セキュリティのため、初回ログイン後に必ずパスワードを変更してください！`);
                } else {
                    logger.info(`✅ 環境変数から管理者パスワードを取得 (強度: ${passwordInfo.strength})`);
                }
            } catch (saveError) {
                logger.error(`[Init] Error saving admin user '${adminEmail}' during password reset:`, saveError);
                // saveError には ValidationError などが含まれる可能性がある
                if (saveError.errors) {
                    for (const key in saveError.errors) {
                        logger.error(`[Init] Validation error for ${key}: ${saveError.errors[key].message}`);
                    }
                }
            }
            return;
        }
        
        // 新規作成の場合 (既存ユーザーが見つからなかった場合)
        logger.info(`[Init] Admin user '${adminEmail}' not found. Creating new admin user.`);
        try {
            const newUser = await User.create({
                username: '管理者', // username も設定
                email: adminEmail,
                password: passwordInfo.password, // セキュリティ強化されたパスワード
                grade: 6, // 例: 最高学年
                isAdmin: true,
                avatar: '👑' 
            });
            logger.info(`[Init] New admin user '${adminEmail}' created successfully. ID: ${newUser._id}`);

            // セキュリティ情報のログ出力
            if (passwordInfo.isGenerated) {
                logger.warn(`🔑 管理者パスワードを自動生成しました: ${maskSensitive(passwordInfo.password, 6)}`);
                logger.warn(`📝 完全なパスワード: ${passwordInfo.password}`);
                logger.warn(`⚠️ セキュリティのため、初回ログイン後に必ずパスワードを変更してください！`);
            } else {
                logger.info(`✅ 環境変数から管理者パスワードを取得 (強度: ${passwordInfo.strength})`);
            }

        } catch (createError) {
            logger.error(`[Init] Error creating new admin user '${adminEmail}':`, createError);
            if (createError.errors) {
                for (const key in createError.errors) {
                    logger.error(`[Init] Validation error for ${key}: ${createError.errors[key].message}`);
                }
            }
        }

    } catch (error) {
        logger.error('[Init] General error in createDefaultAdminUser:', error);
    }
};

// 今日の問題が存在するか確認し、なければ生成する関数
const ensureProblemsForToday = async () => {
    try {
        const today = getTodayDateStringJST();
        logger.info(`[Init] ${today} の問題存在確認...`);
        let problemsGeneratedThisRun = false; // 変数名変更
      for (const difficulty of Object.values(DifficultyRank)) {
            const existingSet = await DailyProblemSet.findOne({ date: today, difficulty });
        if (!existingSet) {
                logger.info(`[Init] ${today} の ${difficulty} 問題が存在しないため生成します...`);
                const seed = `${today}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                
                // generateProblemsから返される値を詳細にログ出力
                const problemsFromGenerator = generateProblems(difficulty, 10, seed); 
                logger.debug(`[Init DEBUG] ensureProblemsForToday: For ${difficulty}, problemsFromGenerator (raw type): ${typeof problemsFromGenerator}`);

                if (problemsFromGenerator && typeof problemsFromGenerator.then === 'function') {
                    logger.debug(`[Init DEBUG] ensureProblemsForToday: problemsFromGenerator for ${difficulty} is a Promise. Awaiting...`);
                    const resolvedProblems = await problemsFromGenerator;
                    logger.debug(`[Init DEBUG] ensureProblemsForToday: For ${difficulty}, resolvedProblems (first element if array):`, resolvedProblems && resolvedProblems.length > 0 ? JSON.stringify(resolvedProblems[0], null, 2) : 'Not an array or empty');
                    logger.debug(`[Init DEBUG] ensureProblemsForToday: For ${difficulty}, resolvedProblems.length: ${resolvedProblems ? resolvedProblems.length : 'undefined'}`);

                    if (resolvedProblems && resolvedProblems.length > 0) {
                        const problemsToSave = resolvedProblems.map(p => ({ 
                            id: p.id, 
                            question: p.question, 
                            correctAnswer: p.answer, 
                            options: p.options 
                        }));
                        logger.debug(`[Init DEBUG] ensureProblemsForToday: For ${difficulty}, problemsToSave (first problem if any):`, problemsToSave.length > 0 ? JSON.stringify(problemsToSave[0], null, 2) : 'Empty after map');
                        
                        try {
                    await DailyProblemSet.create({
                        date: today,
                        difficulty,
                                problems: problemsToSave
                    });
                            logger.info(`[Init] ${today} の ${difficulty} 問題 (${problemsToSave.length}問) を生成・保存しました。`);
                            problemsGeneratedThisRun = true;
                        } catch (dbError) {
                            logger.error(`[Init ERROR] DB save error for ${today}, ${difficulty}:`, dbError);
                        }
                    } else {
                        logger.error(`[Init] ${today} の ${difficulty} 問題の生成に失敗しました (resolvedProblems was null or empty)。`);
                    }
                } else {
                     logger.error(`[Init ERROR] ${today} の ${difficulty} 問題の生成に失敗しました (problemsFromGenerator was not a Promise or was null/empty before await). Actual type: ${typeof problemsFromGenerator}, value:`, problemsFromGenerator);
                }
            } else {
                 logger.info(`[Init INFO] ${today} の ${difficulty} 問題は既にDBに存在します。スキップ。`);
            }
        }
        if (!problemsGeneratedThisRun) { 
            logger.info(`[Init] ${today} の問題について、今回新規生成・保存処理は行われませんでした (既存または生成失敗)。`);
        }
    } catch (error) {
        logger.error('[Init] 今日の問題確認/生成中にエラー:', error);
    }
};
// --------------------------------------------------

// --- initializeApp 関数の定義 (ヘルパー関数の後) ---
async function initializeApp() {
    logger.info('[Init] アプリ初期化開始 (非同期処理として実行)...'); // ログ変更
    try {
        await createDefaultAdminUser();
        await ensureProblemsForToday();
        scheduleNextGeneration(); // これも非同期で良いか、完了を待つべきか確認
        logger.info('[Init] アプリ初期化の主要処理完了 (バックグラウンドで継続する可能性あり)');
    } catch (error) {
        logger.error('!!!!!!!!!!!!!!! INITIALIZE APP ERROR !!!!!!!!!!!!!!!');
        logger.error('[Init] アプリ初期化中に致命的なエラーが発生しました:', error);
        logger.error('Stack:', error instanceof Error ? error.stack : 'No stack available');
        logger.error('このエラーにより、サーバープロセスが不安定になるか、終了する可能性があります。');
        // ここでエラーが発生した場合、アプリケーションの状態が不安定になる可能性があるため、
        // 必要に応じて追加のエラーハンドリングや通知を行う
        // 場合によっては process.exit(1) で明示的に終了させることも検討
    }
}
// ----------------------------------------------

// ★ エラーハンドリングミドルウェアのインポート
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// --- グローバルエラーハンドラー ---
process.on('unhandledRejection', (reason, promise) => {
  logger.error('!!!!!!!!!!!!!!! UNHANDLED REJECTION !!!!!!!!!!!!!!!');
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Stack:', reason instanceof Error ? reason.stack : 'No stack available');
  // アプリケーションをクラッシュさせるか、適切に処理する必要がある
  // process.exit(1); // 本番環境ではこのような処理も検討
});

process.on('uncaughtException', (error) => {
  logger.error('!!!!!!!!!!!!!!! UNCAUGHT EXCEPTION !!!!!!!!!!!!!!!');
  logger.error('Uncaught Exception:', error);
  logger.error('Stack:', error.stack);
  // アプリケーションをクラッシュさせるべき (必須)
  process.exit(1);
});
// --- グローバルエラーハンドラーここまで ---

// --- __dirname & dotenv 初期化を復元 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境設定ファイルを読み込む（優先順位順）
const envFiles = [
  path.resolve(__dirname, './.env'),           // server/.env
  path.resolve(__dirname, '../.env.railway'),  // ルートの.env.railway
  path.resolve(__dirname, '../.env')           // ルートの.env
];

let envLoaded = false;
for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    logger.info(`[dotenv] Loading environment from: ${envPath}`);
    const dotenvResult = dotenv.config({ path: envPath });
    if (dotenvResult.error) {
      logger.error(`[dotenv] Error loading ${envPath}:`, dotenvResult.error);
    } else {
      logger.info(`[dotenv] Successfully loaded: ${envPath}`);
      envLoaded = true;
      break; // 最初に見つかったファイルのみ読み込み
    }
  }
}

if (!envLoaded) {
  logger.info('[dotenv] No .env files found, using environment variables (e.g., Railway Variables).');
}

// *** セキュリティチェック：必須ENV変数の検証 ***
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('🔒 PRODUCTION環境でJWT_SECRETが未設定です。サーバーを停止します。');
    process.exit(1);
  } else {
    logger.warn('🔒 JWT_SECRET が未設定です。開発環境用のデフォルトキーを使用します。');
    process.env.JWT_SECRET = 'development-only-secret-key-change-in-production';
  }
}

if (!process.env.MONGODB_MOCK) {
  logger.info('🧪 MONGODB_MOCK が未設定のため false をセット');
  process.env.MONGODB_MOCK = 'false';
}

logger.info(`✅ ENV SUMMARY → NODE_ENV=${process.env.NODE_ENV}, MONGODB_MOCK=${process.env.MONGODB_MOCK}`);

// MongoDBサーバーに接続 & サーバー起動
const startServer = async () => {
    try {
        console.log('🔍 [DEBUG] startServer開始');
        // MongoDB接続文字列
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morningmathdb';
        console.log('🔍 [DEBUG] MongoDB URI取得完了');
        
        // モックモード確認
        const useMockDB = process.env.MONGODB_MOCK === 'true';
        console.log('🔍 [DEBUG] モックモード確認:', useMockDB);
        
        if (useMockDB) {
          console.log('🔍 [DEBUG] モックモード分岐開始');
          logger.warn('⚠️ モックモードで実行中 - インメモリデータベースを使用します');
          try {
            console.log('🔍 [DEBUG] connectDB import開始');
            // モックデータの初期化のみ行う（MongoMemoryServerは使用しない）
            const { connectDB } = await import('./config/database.js');
            console.log('🔍 [DEBUG] connectDB import完了');
            await connectDB();
            console.log('🔍 [DEBUG] connectDB実行完了');
            logger.info('✅ モックデータベース初期化完了');
          } catch (error) {
            logger.error('💥 モックデータの初期化に失敗しました:', error);
            process.exit(1);
          }
        } else {
          console.log('🔍 [DEBUG] 本番MongoDB分岐開始');
          // 通常のMongoDBに接続
          try {
            console.log('🔍 [DEBUG] mongoose.connect開始');
            await mongoose.connect(mongoUri, {
              // useNewUrlParser: true,
              // useUnifiedTopology: true,
              serverSelectionTimeoutMS: 15000, // 通常DBも少し延長
              connectTimeoutMS: 15000,
              socketTimeoutMS: 30000,
              family: 4
            });
            console.log('🔍 [DEBUG] mongoose.connect成功');
            logger.info(`✅ MongoDB サーバーに接続しました: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}`);
          } catch (err) {
            console.error('🔍 [DEBUG] mongoose.connect失敗');
            logger.error('💥 MongoDB 接続エラー:', err.message);
            logger.error('💥 エラー詳細:', {
              name: err.name,
              message: err.message,
              code: err.code,
              stack: err.stack?.split('\n')[0]
            });
            logger.error('    接続文字列確認:', mongoUri.replace(/\/\/[^@]+@/, '//***:***@'));
            logger.error('    MongoDBサーバーが起動しているか確認してください。');
            process.exit(1);
          }
        }
        
        console.log('🔍 [DEBUG] MongoDB接続後処理開始');
        
        // MongoDB接続監視
        mongoose.connection.on('error', err => {
          logger.error('MongoDB 接続エラー:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
          logger.warn('MongoDB 接続が切断されました。再接続します...');
        });
        
        console.log('🔍 [DEBUG] Express app作成開始');
        const app = express();
        console.log('🔍 [DEBUG] Express app作成完了');
        
        console.log('🔍 [DEBUG] Helmet設定開始');
        // ✅ Helmet で主要ヘッダーを一括付与
        app.use(helmet());
        console.log('🔍 [DEBUG] Helmet設定完了');

        console.log('🔍 [DEBUG] カスタムセキュリティヘッダー設定開始');
        // ✅ カスタムセキュリティヘッダー追加（Helmetの後に上書き・追加）
        app.use(securityHeaders);
        console.log('🔍 [DEBUG] カスタムセキュリティヘッダー設定完了');
        
        console.log('🔍 [DEBUG] Rate Limiter設定開始');
        // ✅ Rate Limiting追加
        app.use(rateLimiter);
        console.log('🔍 [DEBUG] Rate Limiter設定完了');
        
        // ✅ セキュリティ強化: 厳格なCORS設定
        app.use(cors({
          origin: environmentConfig.getCorsOrigin(),
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
          optionsSuccessStatus: 200,
          maxAge: 86400 // 24時間
        }));

        // ★ グローバルリクエストロガーをCORSの直後、ボディパーサーの前に移動
        app.use((req, res, next) => {
          logger.debug(`[Global Request Logger] Method: ${req.method}, URL: ${req.originalUrl}, IP: ${req.ip}, Origin: ${req.headers.origin}, Body (raw): ${req.body}`); // Originヘッダーと生のBodyもログに追加
          next();
        });
        
        // app.use(cors({ // 元の詳細なCORS設定 (コメントアウト)
        //     origin: function (origin, callback) {
        //         logger.info('[CORS] Request from origin:', origin);
        //         const allowedOrigins = [FRONTEND_ORIGIN];
        //         if (origin && allowedOrigins.includes(origin)) {
        //             logger.info(`[CORS] Origin ${origin} allowed.`);
        //             callback(null, true);
        //         } else {
        //             console.warn(`[CORS] Origin ${origin || 'N/A'} rejected. Allowed: ${allowedOrigins.join(', ')}`);
        //             callback(null, false); // ここで拒否されると後続のミドルウェアは実行されない
        //         }
        //     },
        //     credentials: true,
        //     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        //     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        //     optionsSuccessStatus: 204,
        //     maxAge: 86400 
        // }));

        // パフォーマンス監視ミドルウェア（最初に設定）
        app.use(performanceMonitor);
        
        app.use(express.json()); // JSON形式のリクエストボディをパース
        app.use(express.urlencoded({ extended: true })); // URLエンコードされたリクエストボディをパース
        app.use(cookieParser());
        
        // ✅ 入力値サニタイゼーション追加
        app.use(sanitizeInput);
        
        // dayjs.extend(utc); // dayjsの初期化はトップレベルに移動済みなので不要
        // dayjs.extend(timezone);
        // dayjs.extend(isBetween);
        // dayjs.tz.setDefault("Asia/Tokyo");

        // --- 静的ファイル配信 (Railway.app用) ---
        if (process.env.NODE_ENV === 'production') {
          app.use(express.static(path.join(process.cwd(), 'dist')));
          
          // SPA用のキャッチオール ルート
          app.get('*', (req, res, next) => {
            // API ルートは除外
            if (req.path.startsWith('/api/')) {
              return next();
            }
            res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
          });
        }

        // --- API ルート定義 --- 
        app.get('/api', (req, res) => {
          res.json({ message: '朝の計算チャレンジAPIへようこそ！' });
        });

        app.get('/api/health', (req, res) => {
          logger.debug('[API] GET /api/health endpoint hit (connection test)');
          res.status(200).json({ success: true, message: 'Backend health check successful!' });
        });

        // エラーハンドリングミドルウェアの定義 (他のapp.useの後に配置)
        // ルート定義
        app.use((req, res, next) => {
          logger.debug(`[Server.js] Incoming request: ${req.method} ${req.originalUrl}`);
          if (req.method === 'POST' && req.originalUrl.startsWith('/api/auth/login')) {
            logger.debug('[Server.js] Login request body:', req.body);
          }
          next();
        });

        app.use('/api/auth', authRoutes);

        app.get('/api/rankings/testpublic', (req, res) => {
          logger.debug('>>>>>> SERVER.JS: /api/rankings/testpublic hit successfully <<<<<<');
          res.status(200).json({ message: 'Test public route for rankings OK' });
        });

        app.use('/api/rankings', rankingRoutes);

        app.use('/api/problems', problemRoutes);
        app.use('/api/users', userRoutes);
        app.use('/api/admin', adminRoutes);
        app.use('/api/monitoring', monitoringRoutes);
        app.use('/api/history', historyRoutes);
        app.use('/api/challenge', challengeRoutes);
        app.use('/api/leaderboard', leaderboardRoutes);
        app.use('/api/billing', billingRoutes);
        app.use('/api/progress', progressRoutes);
        app.use('/api/counseling', counselingRoutes);

        app.post('/api/problems/submit', protect, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          logger.debug(`[API /api/problems/submit] User: ${req.user?._id}`);
          res.json({success:true, message: "/api/problems/submit accessed (server/server.js)"}); 
        });

        app.post('/api/problems/generate', protect, admin, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          logger.debug(`[API /api/problems/generate] User: ${req.user?._id}, Admin: ${req.user?.isAdmin}`);
          res.json({success:true, message: "/api/problems/generate accessed (server/server.js)"}); 
        });

        app.get('/api/problems/edit', protect, admin, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          logger.debug(`[API /api/problems/edit GET] User: ${req.user?._id}, Admin: ${req.user?.isAdmin}`);
          res.json({success:true, message: "/api/problems/edit GET accessed (server/server.js)"}); 
        });

        app.post('/api/problems/edit', protect, admin, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          logger.debug(`[API /api/problems/edit POST] User: ${req.user?._id}, Admin: ${req.user?.isAdmin}`);
          res.json({success:true, message: "/api/problems/edit POST accessed (server/server.js)"}); 
    });

        // ★ 未定義ルートの処理 (404 Not Found)
        app.use(notFound);

        // ★ グローバルエラーハンドラ (全てのルート定義の後)
        app.use(errorHandler);

        // サーバー起動
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`✅ サーバーが起動しました！ポート ${PORT}、ホスト 0.0.0.0 で待機中...`); // ログ修正
            logger.info(`⏰ チャレンジ時間制限 ${process.env.DISABLE_TIME_CHECK === 'true' ? '無効' : '有効'}`);
            logger.info(`💾 DBモード: ${process.env.MONGODB_MOCK === 'true' ? 'モック (InMemory)' : 'MongoDB'}`);
            logger.info('✨ Expressサーバーはリクエストの受付を開始しました。ここまでは正常です。✨');
            
            // パフォーマンス監視を開始
            startPerformanceMonitoring();
            logger.info('📊 パフォーマンス監視システムが開始されました');
        

            // モック環境以外でのみMongoDB接続後の初期化処理を実行
            if (!useMockDB) {
                mongoose.connection.once('open', async () => {
                    logger.info('[Init] MongoDB接続確立 - 初期化処理を非同期で開始します (500ms待機後)');
                    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms待機は維持

                    // initializeApp を呼び出すが、await しないことで非同期実行とする
                    // エラーは initializeApp 内部で処理するか、ここで .catch() する
                    initializeApp().catch(initError => {
                        logger.error('[Init] 非同期初期化処理のトップレベルでエラーハンドリング:', initError);
                    });
                });
            } else {
                logger.info('[Init] モック環境のため、MongoDB接続イベントはスキップします');
            }
        });

  } catch (error) {
        logger.error('サーバー起動中にエラーが発生しました:', error);
        process.exit(1);
  }
};

// --- startServer 関数の呼び出し (ファイルの末尾) ---
startServer();
