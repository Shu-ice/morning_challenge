import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import environmentConfig from './config/environment.js';
import { logger } from './utils/logger.js';
import { performanceMonitor, startPerformanceMonitoring } from './middleware/performanceMiddleware.js';

// ESM環境で __dirname を再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// サーバーディレクトリの .env ファイルを読み込む
const envPath = path.resolve(__dirname, './.env');
logger.info(`[dotenv] Attempting to load .env file from: ${envPath}`);
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
  logger.error('[dotenv] Error loading .env file:', dotenvResult.error);
} else {
  logger.info('[dotenv] .env file loaded successfully.');
}

// 🔥 緊急修正: モック機能を強制有効化
if (!process.env.MONGODB_MOCK) {
  console.log('🔧 [EMERGENCY FIX] MONGODB_MOCK環境変数が設定されていません。強制的に有効化します...');
  process.env.MONGODB_MOCK = 'true';
  process.env.DISABLE_TIME_CHECK = 'true';
  process.env.JWT_SECRET = 'morning-challenge-super-secret-key';
}

console.log('🎯 [CURRENT ENV] MONGODB_MOCK:', process.env.MONGODB_MOCK);
console.log('🎯 [CURRENT ENV] DISABLE_TIME_CHECK:', process.env.DISABLE_TIME_CHECK);
console.log('🎯 [CURRENT ENV] JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');

// 環境設定を表示
environmentConfig.displayConfig();

import express from 'express';
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
import { getHistory } from './controllers/problemController.js';

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

logger.info(`🚀 サーバーがポート ${PORT} で起動準備中...`);
logger.info(`🔗 フロントエンドオリジン許可予定: ${FRONTEND_ORIGIN}`);

// ポート使用状況をチェックする関数
const checkPortAvailability = async (port) => {
  return new Promise((resolve) => {
    const server = express().listen(port, () => {
      server.close(() => resolve(true));
    }).on('error', () => resolve(false));
  });
};

// 利用可能なポートを見つける関数
const findAvailablePort = async (startPort, maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const isAvailable = await checkPortAvailability(port);
    if (isAvailable) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
};

const JST_OFFSET = 9 * 60;
const problemGenerationLocks = new Map();

// --- ヘルパー関数定義 (initializeApp より前に定義) ---
const isChallengeTimeAllowed = () => {
    if (process.env.DISABLE_TIME_CHECK === 'true') {
    // console.log('[Time Check] Skipped due to DISABLE_TIME_CHECK=true'); // 必要ならコメント解除
        return true;
    }

    const nowJST = dayjs().tz();
    const currentHour = nowJST.hour();
    const currentMinute = nowJST.minute();

    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = 6 * 60 + 30;
    const endTimeInMinutes = 8 * 60 + 0;

    const isAllowed = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    if (!isAllowed) {
        logger.warn(`[Time Check] Access denied. Current JST: ${nowJST.format('HH:mm')}. Allowed: 06:30 - 08:00`);
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

// MongoDBサーバーに接続 & サーバー起動
const startServer = async () => {
    try {
        // MongoDB接続文字列
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morningmathdb';
        
        // モックモード確認
        const useMockDB = process.env.MONGODB_MOCK === 'true';
        
        if (useMockDB) {
          logger.warn('⚠️ モックモードで実行中 - インメモリデータベースを使用します');
          try {
            // 🔥 緊急修正: connectDB関数を使用してモックデータを初期化
            const { connectDB } = await import('./config/database.js');
            await connectDB();
            logger.info('✅ モックデータベース初期化完了');
            
            // MongoMemoryServerも併用
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            const mongoServer = await MongoMemoryServer.create();
            const mockMongoUri = mongoServer.getUri();
            logger.info('[Init] InMemory DB URI:', mockMongoUri);
            
            await mongoose.connect(mockMongoUri, {
              serverSelectionTimeoutMS: 30000,
              connectTimeoutMS: 30000,         
              socketTimeoutMS: 45000,          
              family: 4 
            });
            logger.info('✅ MongoDB インメモリサーバーに接続成功');
          } catch (error) {
            logger.error('💥 インメモリDBの初期化に失敗しました:', error);
            process.exit(1);
          }
      } else {
          // 通常のMongoDBに接続
          mongoose.connect(mongoUri, {
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000, // 通常DBも少し延長
            connectTimeoutMS: 15000,
            socketTimeoutMS: 30000,
            family: 4
          })
          .then(() => logger.info(`✅ MongoDB サーバーに接続しました: ${mongoUri}`))
          .catch(err => {
            logger.error('💥 MongoDB 接続エラー:', err);
            logger.error('    接続文字列を確認してください:', mongoUri);
            logger.error('    MongoDBサーバーが起動しているか確認してください。');
            process.exit(1);
          });
        }
        
        // MongoDB接続監視
        mongoose.connection.on('error', err => {
          logger.error('MongoDB 接続エラー:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
          logger.warn('MongoDB 接続が切断されました。再接続します...');
        });
        
        const app = express();
        
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
        //         console.log('[CORS] Request from origin:', origin);
        //         const allowedOrigins = [FRONTEND_ORIGIN];
        //         if (origin && allowedOrigins.includes(origin)) {
        //             console.log(`[CORS] Origin ${origin} allowed.`);
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
        
        // dayjs.extend(utc); // dayjsの初期化はトップレベルに移動済みなので不要
        // dayjs.extend(timezone);
        // dayjs.extend(isBetween);
        // dayjs.tz.setDefault("Asia/Tokyo");

        // --- API ルート定義 --- 
        app.get('/', (req, res) => {
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
        app.use('/api/admin', adminRoutes);
        app.use('/api/monitoring', monitoringRoutes);

        app.post('/api/problems/submit', protect, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          logger.debug(`[API /api/problems/submit] User: ${req.user?._id}`);
          res.json({success:true, message: "/api/problems/submit accessed (server/server.js)"}); 
        });

        app.get('/api/history', protect, getHistory);

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
        app.listen(PORT, '127.0.0.1', () => {
            logger.info(`✅ サーバーが起動しました！ポート ${PORT}、ホスト 127.0.0.1 で待機中...`); // ログ修正
            logger.info(`⏰ チャレンジ時間制限 ${process.env.DISABLE_TIME_CHECK === 'true' ? '無効' : '有効'}`);
            logger.info(`💾 DBモード: ${process.env.MONGODB_MOCK === 'true' ? 'モック (InMemory)' : 'MongoDB'}`);
            logger.info('✨ Expressサーバーはリクエストの受付を開始しました。ここまでは正常です。✨');
            
            // パフォーマンス監視を開始
            startPerformanceMonitoring();
            logger.info('📊 パフォーマンス監視システムが開始されました');
        

            // MongoDB接続後に初期化処理を呼び出すが、完了を待たない
            mongoose.connection.once('open', async () => {
                logger.info('[Init] MongoDB接続確立 - 初期化処理を非同期で開始します (500ms待機後)');
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms待機は維持

                // initializeApp を呼び出すが、await しないことで非同期実行とする
                // エラーは initializeApp 内部で処理するか、ここで .catch() する
                initializeApp().catch(initError => {
                    logger.error('[Init] 非同期初期化処理のトップレベルでエラーハンドリング:', initError);
                });
            });
        });

  } catch (error) {
        logger.error('サーバー起動中にエラーが発生しました:', error);
        process.exit(1);
  }
};

// --- startServer 関数の呼び出し (ファイルの末尾) ---
startServer();
