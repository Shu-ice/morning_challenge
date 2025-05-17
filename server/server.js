import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM環境で __dirname を再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートの .env ファイルを読み込む
const envPath = path.resolve(__dirname, '../.env');
console.log(`[dotenv] Attempting to load .env file from: ${envPath}`); // デバッグログ追加
const dotenvResult = dotenv.config({ path: envPath }); // 戻り値を取得
if (dotenvResult.error) {
  console.error('[dotenv] Error loading .env file:', dotenvResult.error);
} else {
  console.log('[dotenv] .env file loaded successfully.');
}

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { protect, admin } from './middleware/authMiddleware.js'; // ← コメントアウトを解除
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import User from './models/User.js';
import DailyProblemSet from './models/DailyProblemSet.js';
import Result from './models/Result.js';
import { generateProblems, DifficultyRank } from './utils/problemGenerator.js';
import authRoutes from './routes/authRoutes.js'; // 認証ルートをインポート
import { generateProblems as generateProblemsUtil } from './utils/problemGenerator.js'; // 問題生成ユーティリティをインポート
import rankingRoutes from './routes/rankingRoutes.js'; // ESM形式でインポート

// --- dayjs プラグインの適用 (トップレベルで実行) ---
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.tz.setDefault("Asia/Tokyo"); // デフォルトタイムゾーンもここで設定
// -----------------------------------------------

// 明示的なJWT設定 - 環境変数から取得
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('エラー: JWT_SECRET 環境変数が設定されていません。');
  process.exit(1); // シークレットがない場合は起動失敗
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// ポート設定 - 環境変数から取得、デフォルトを修正
const PORT = process.env.BACKEND_PORT || 5003;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3004;
const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;
console.log(`[dotenv] Loaded FRONTEND_PORT: ${process.env.FRONTEND_PORT}`); // デバッグログ追加
console.log(`🚀 サーバーがポート ${PORT} で起動準備中...`);
console.log(`🔗 フロントエンドオリジン許可予定: ${FRONTEND_ORIGIN}`);

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
            console.log(`[Time Check] Access denied. Current JST: ${nowJST.format('HH:mm')}. Allowed: 06:30 - 08:00`);
        }
        return isAllowed;
    };

    const getTodayDateStringJST = () => {
        return dayjs().tz().format('YYYY-MM-DD');
    };

    const generateProblemsForNextDay = async () => {
      try {
        const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
        console.log(`[自動生成] ${tomorrow}の問題セットを生成します...`);
        
        // 全難易度の問題を生成
        for (const difficulty of Object.values(DifficultyRank)) {
          // 既に存在するかチェック
          const existingSet = await DailyProblemSet.findOne({ date: tomorrow, difficulty });
          
          if (existingSet) {
            console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題セットは既に存在します。スキップします。`);
            continue;
          }
          
          console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題を生成します...`);
          
          try {
            // 決定論的に問題を生成（日付と難易度から一貫したシード値を生成）
            const seed = `${tomorrow}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const problems = generateProblems(difficulty, 10, seed);
            
            if (!problems || problems.length === 0) {
              console.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成に失敗しました。`);
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
            console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成完了 (${problems.length}問)`);
          } catch (error) {
            console.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成中にエラー:`, error);
          }
        }
        
        console.log(`[自動生成] ${tomorrow}の全難易度の問題生成が完了しました。`);
      } catch (error) {
        console.error('[自動生成] 翌日問題の生成中にエラー:', error);
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
      console.log(`[スケジューラ] 次回の問題自動生成は ${nextRun.format('YYYY-MM-DD HH:mm:ss')} に実行されます (${Math.round(timeToNextRun / (1000 * 60))}分後)`);
      setTimeout(() => {
        console.log('[スケジューラ] 定期実行: 翌日問題の自動生成を開始します');
        generateProblemsForNextDay().finally(() => {
          scheduleNextGeneration();
        });
      }, timeToNextRun);
    };
    
const createDefaultAdminUser = async () => {
    try {
        const adminEmail = 'admin@example.com';
        const adminPassword = 'admin123'; // 平文パスワード

        // Mongoose の User モデルが正しくインポート・初期化されているか確認
        if (!User || typeof User.findOne !== 'function') {
            console.error('[Init] CRITICAL: User model is not available in createDefaultAdminUser.');
            return;
        }
        
        let existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log(`[Init] Admin user '${adminEmail}' already exists. Attempting to reset password.`);
            if (!existingAdmin.isAdmin) {
                console.log(`[Init] Granting admin rights to '${adminEmail}'.`);
                existingAdmin.isAdmin = true;
            }

            // パスワードを強制的にリセット
            // pre('save') フックが正しく動作するため、ここで直接ハッシュ化せず、平文をセットする
            existingAdmin.password = adminPassword; 
            
            try {
                await existingAdmin.save(); // ここで pre-save フックが実行されハッシュ化される
                console.log(`[Init] Admin user '${adminEmail}' password reset and saved.`);

                // --- ★ デバッグ: 保存直後に再取得してパスワード検証 ---
                const reloadedAdmin = await User.findOne({ email: adminEmail }).select('+password');
                if (reloadedAdmin && reloadedAdmin.password) {
                    console.log(`[Init Debug] Reloaded admin. Stored hash length: ${reloadedAdmin.password.length}. Hash starts with: ${reloadedAdmin.password.substring(0,10)}...`);
                    const isMatchAfterSave = await reloadedAdmin.matchPassword(adminPassword); // 平文 'admin123' と比較
                    console.log(`[Init Debug] Password match test immediately after save for '${adminEmail}': ${isMatchAfterSave}`);
                    if (!isMatchAfterSave) {
                        console.error(`[Init Debug] CRITICAL: Password mismatch immediately after saving for default admin! Entered: '${adminPassword}'`);
                        // 念のため、再取得したユーザーのハッシュともう一度比較してみる (pre-saveが機能したか確認)
                        if (typeof bcrypt !== 'undefined' && typeof bcrypt.compareSync === 'function') {
                           // 注意: bcrypt.compareSync は利用可能なら。bcryptjsなら常にasync
                           // const directCompare = bcrypt.compareSync(adminPassword, reloadedAdmin.password);
                           // console.log(`[Init Debug] Direct bcrypt.compareSync with reloaded hash: ${directCompare}`);
                        }
                    }
                } else {
                    console.error(`[Init Debug] CRITICAL: Could not reload admin or password after save for '${adminEmail}'. Reloaded admin:`, reloadedAdmin);
                }
                // --- ★ デバッグここまで ---
            } catch (saveError) {
                console.error(`[Init] Error saving admin user '${adminEmail}' during password reset:`, saveError);
                // saveError には ValidationError などが含まれる可能性がある
                if (saveError.errors) {
                    for (const key in saveError.errors) {
                        console.error(`[Init] Validation error for ${key}: ${saveError.errors[key].message}`);
                    }
                }
            }
            return;
        }
        
        // 新規作成の場合 (既存ユーザーが見つからなかった場合)
        console.log(`[Init] Admin user '${adminEmail}' not found. Creating new admin user.`);
        try {
            const newUser = await User.create({
                username: '管理者', // username も設定
                email: adminEmail,
                password: adminPassword, // ここでも平文。pre-saveでハッシュ化
                grade: 6, // 例: 最高学年
                isAdmin: true,
                avatar: '👑' 
            });
            console.log(`[Init] New admin user '${adminEmail}' created successfully. ID: ${newUser._id}`);

            // --- ★ デバッグ: 新規作成直後も検証 ---
            const reloadedNewAdmin = await User.findOne({ email: adminEmail }).select('+password');
            if (reloadedNewAdmin && reloadedNewAdmin.password) {
                console.log(`[Init Debug] Reloaded new admin. Stored hash length: ${reloadedNewAdmin.password.length}. Hash starts with: ${reloadedNewAdmin.password.substring(0,10)}...`);
                const isMatchAfterCreate = await reloadedNewAdmin.matchPassword(adminPassword);
                console.log(`[Init Debug] Password match test immediately after create for '${adminEmail}': ${isMatchAfterCreate}`);
                if (!isMatchAfterCreate) {
                    console.error(`[Init Debug] CRITICAL: Password mismatch immediately after creating default admin! Entered: '${adminPassword}'`);
                }
            } else {
                console.error(`[Init Debug] CRITICAL: Could not reload new admin or password after create for '${adminEmail}'.`);
            }
            // --- ★ デバッグここまで ---

        } catch (createError) {
            console.error(`[Init] Error creating new admin user '${adminEmail}':`, createError);
            if (createError.errors) {
                for (const key in createError.errors) {
                    console.error(`[Init] Validation error for ${key}: ${createError.errors[key].message}`);
                }
            }
        }

    } catch (error) {
        console.error('[Init] General error in createDefaultAdminUser:', error);
    }
};

// 今日の問題が存在するか確認し、なければ生成する関数
const ensureProblemsForToday = async () => {
    try {
        const today = getTodayDateStringJST();
        console.log(`[Init] ${today} の問題存在確認...`);
        let problemsGenerated = false;
      for (const difficulty of Object.values(DifficultyRank)) {
            const existingSet = await DailyProblemSet.findOne({ date: today, difficulty });
        if (!existingSet) {
                console.log(`[Init] ${today} の ${difficulty} 問題が存在しないため生成します...`);
                const seed = `${today}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const problems = generateProblems(difficulty, 10, seed);
                if (problems && problems.length > 0) {
                    await DailyProblemSet.create({
                        date: today,
                        difficulty,
                        problems: problems.map(p => ({ id: p.id, question: p.question, correctAnswer: p.answer, options: p.options }))
                    });
                    console.log(`[Init] ${today} の ${difficulty} 問題 (${problems.length}問) を生成・保存しました。`);
                    problemsGenerated = true;
                } else {
                    console.error(`[Init] ${today} の ${difficulty} 問題の生成に失敗しました。`);
                }
            }
        }
        if (!problemsGenerated) {
            console.log(`[Init] ${today} の全難易度の問題は既に存在します。`);
        }
    } catch (error) {
        console.error('[Init] 今日の問題確認/生成中にエラー:', error);
    }
};
// --------------------------------------------------

// --- initializeApp 関数の定義 (ヘルパー関数の後) ---
async function initializeApp() {
    console.log('[Init] アプリ初期化開始...');
    try {
        await createDefaultAdminUser();
        await ensureProblemsForToday();
        scheduleNextGeneration();
        console.log('[Init] アプリ初期化完了');
    } catch (error) {
        console.error('[Init] アプリ初期化中にエラー:', error);
    }
}
// ----------------------------------------------

// ★ エラーハンドリングミドルウェアのインポート
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// MongoDBサーバーに接続 & サーバー起動
const startServer = async () => {
    try {
        // MongoDB接続文字列
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morningmathdb';
        
        // モックモード確認
        const useMockDB = process.env.MONGODB_MOCK === 'true';
        
        if (useMockDB) {
          console.log('⚠️ モックモードで実行中 - インメモリデータベースを使用します');
          try {
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            const mongoServer = await MongoMemoryServer.create();
            const mockMongoUri = mongoServer.getUri();
            console.log('[Init] InMemory DB URI:', mockMongoUri);
            
            mongoose.connect(mockMongoUri, {
              // useNewUrlParser: true, // mongoose 6+ では不要
              // useUnifiedTopology: true, // mongoose 6+ では不要
              serverSelectionTimeoutMS: 30000, // ★ タイムアウトを30秒に延長
              connectTimeoutMS: 30000,         // ★ 接続タイムアウトも設定
              socketTimeoutMS: 45000,          // ★ ソケットタイムアウトも設定
              family: 4 // Optionally force IPv4
            })
            .then(() => console.log('✅ MongoDB インメモリサーバーに接続成功'))
            .catch(err => {
              console.error('💥 MongoDB インメモリ接続エラー:', err);
              // ここで終了せず、通常のDB接続を試みるかもしれないが、一旦エラー表示のみ
            });
          } catch (error) {
            console.error('💥 インメモリDBの初期化に失敗しました:', error);
            // 通常のMongoDB接続へのフォールバックは一旦コメントアウト
            // console.log('通常のMongoDBに接続を試みます...');
            // mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
            process.exit(1); // インメモリ初期化失敗は致命的エラーとする
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
          .then(() => console.log(`✅ MongoDB サーバーに接続しました: ${mongoUri}`))
          .catch(err => {
            console.error('💥 MongoDB 接続エラー:', err);
            console.error('    接続文字列を確認してください:', mongoUri);
            console.error('    MongoDBサーバーが起動しているか確認してください。');
            process.exit(1);
          });
        }
        
        // MongoDB接続監視
        mongoose.connection.on('error', err => {
          console.error('MongoDB 接続エラー:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
          console.warn('MongoDB 接続が切断されました。再接続します...');
        });
        
        const app = express();
        
        app.use(cors({
            origin: function (origin, callback) {
                console.log('[CORS] Request from origin:', origin);
                // 許可するオリジンを環境変数から取得したものに限定
                const allowedOrigins = [FRONTEND_ORIGIN];

                // Originヘッダーが存在し、許可リストに含まれている場合のみ許可
                if (origin && allowedOrigins.includes(origin)) {
                    console.log(`[CORS] Origin ${origin} allowed.`);
                    callback(null, true);
                } else {
                    // Originがない場合、または許可リストに含まれない場合は拒否
                    console.warn(`[CORS] Origin ${origin || 'N/A'} rejected. Allowed: ${allowedOrigins.join(', ')}`);
                    // エラーを返すのではなく、許可しないことを示す（多くのブラウザはこれでブロックする）
                    callback(null, false);
                    // もしくは明確にエラーを返す場合:
                    // callback(new Error(`Origin ${origin || 'N/A'} not allowed by CORS policy.`));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            optionsSuccessStatus: 204, // OPTIONSリクエストには204を返す
            maxAge: 86400 // Preflightリクエストのキャッシュ時間
        }));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        
        dayjs.extend(utc);
        dayjs.extend(timezone);
        dayjs.extend(isBetween);
        dayjs.tz.setDefault("Asia/Tokyo");

        // --- API ルート定義 --- 
        app.get('/', (req, res) => {
          res.json({ message: '朝の計算チャレンジAPIへようこそ！' });
        });

        app.get('/api/', (req, res) => {
          console.log('[API] GET /api/ endpoint hit (connection test)');
          res.status(200).json({ success: true, message: 'Backend connection successful!' });
        });

        app.use('/api/auth', authRoutes);

        app.get('/api/rankings/testpublic', (req, res) => {
          console.log('>>>>>> SERVER.JS: /api/rankings/testpublic hit successfully <<<<<<');
          res.status(200).json({ message: 'Test public route for rankings OK' });
        });

        app.use('/api/rankings', rankingRoutes);

        app.get('/api/problems', protect, async (req, res) => { // コメントアウトを解除
      const { difficulty, date } = req.query;
          const userId = req.user._id; 
          const isAdmin = req.user.isAdmin; 
          // ...(元の処理)... 現状は省略し、動作確認後に復元
      if (!difficulty || !Object.values(DifficultyRank).includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: '有効な難易度(beginner, intermediate, advanced, expert)を指定してください。'
        });
      }
          // このルートの完全な処理は長いため、一旦ここまでとし、後で元のコードに戻す前提
          console.log(`[API /api/problems] User: ${userId}, Admin: ${isAdmin}, Difficulty: ${difficulty}, Date: ${date}`);
          res.json({success:true, message: "/api/problems accessed (server/server.js)"}); 
        });

        app.post('/api/problems/submit', protect, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          console.log(`[API /api/problems/submit] User: ${req.user?._id}`);
          res.json({success:true, message: "/api/problems/submit accessed (server/server.js)"}); 
        });

        app.get('/api/history', protect, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          console.log(`[API /api/history] User: ${req.user?._id}`);
          res.json({success:true, message: "/api/history accessed (server/server.js)"}); 
        });

        app.post('/api/problems/generate', protect, admin, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          console.log(`[API /api/problems/generate] User: ${req.user?._id}, Admin: ${req.user?.isAdmin}`);
          res.json({success:true, message: "/api/problems/generate accessed (server/server.js)"}); 
        });

        app.get('/api/problems/edit', protect, admin, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          console.log(`[API /api/problems/edit GET] User: ${req.user?._id}, Admin: ${req.user?.isAdmin}`);
          res.json({success:true, message: "/api/problems/edit GET accessed (server/server.js)"}); 
        });

        app.post('/api/problems/edit', protect, admin, async (req, res) => { // コメントアウトを解除
          // ...(元の処理)... 現状は省略
          console.log(`[API /api/problems/edit POST] User: ${req.user?._id}, Admin: ${req.user?.isAdmin}`);
          res.json({success:true, message: "/api/problems/edit POST accessed (server/server.js)"}); 
    });

        // ★ 未定義ルートの処理 (404 Not Found)
        app.use(notFound);

        // ★ グローバルエラーハンドラ (全てのルート定義の後)
        app.use(errorHandler);

        // サーバー起動
        app.listen(PORT, () => {
            console.log(`✅ サーバーが起動しました！ポート ${PORT} で待機中...`); // ログ修正
            console.log(`⏰ チャレンジ時間制限 ${process.env.DISABLE_TIME_CHECK === 'true' ? '無効' : '有効'}`);
            console.log(`💾 DBモード: ${process.env.MONGODB_MOCK === 'true' ? 'モック (InMemory)' : 'MongoDB'}`);

            // MongoDB接続後に初期化処理を実行
            mongoose.connection.once('open', async () => {
                console.log('[Init] MongoDB接続確立 - 初期化処理呼び出し (500ms待機)');
                await new Promise(resolve => setTimeout(resolve, 500));
                await initializeApp();
            });
        });

  } catch (error) {
        console.error('サーバー起動中にエラーが発生しました:', error);
        process.exit(1);
  }
};

// --- startServer 関数の呼び出し (ファイルの末尾) ---
startServer();
