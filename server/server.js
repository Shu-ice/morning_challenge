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
import { protect, admin } from './middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import User from './models/User.js';
import DailyProblemSet from './models/DailyProblemSet.js';
import Result from './models/Result.js';
import { generateProblems, DifficultyRank } from './utils/problemGenerator.js';
import authRoutes from './routes/authRoutes.js'; // 認証ルートをインポート
import { generateProblems as generateProblemsUtil } from './utils/problemGenerator.js'; // 問題生成ユーティリティをインポート

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

        // ★ /api/ ルートを追加 (接続テスト用)
        app.get('/api/', (req, res) => {
          console.log('[API] GET /api/ endpoint hit (connection test)');
          res.status(200).json({ success: true, message: 'Backend connection successful!' });
        });

        // ★ 認証ルートのマウント
        app.use('/api/auth', authRoutes);

    app.get('/api/problems', protect, async (req, res) => {
      const { difficulty, date } = req.query;
      const userId = req.user._id; // 認証ミドルウェアから直接ユーザーIDを取得
      const isAdmin = req.user.isAdmin; // 管理者フラグを取得

      if (!difficulty || !Object.values(DifficultyRank).includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: '有効な難易度(beginner, intermediate, advanced, expert)を指定してください。'
        });
      }

      // usernameのチェックを削除 - 認証済みユーザーのIDを使用するため不要

      let searchDate = date;
      const todayJST = getTodayDateStringJST();

      // --- 1日1回挑戦チェック (管理者以外) ---
      if (!isAdmin) {
        try {
          // userIdとdateで既存の結果を検索
          const existingResult = await Result.findOne({
            userId: userId,
            date: todayJST // チェックは常に「今日」に対して行う
          });

          if (existingResult) {
            console.log(`[Attempt Check] User ID ${userId} already attempted today (${todayJST}). Access denied.`);
            return res.status(403).json({
              success: false,
              message: '今日は既に挑戦済みです。明日また挑戦してください。'
            });
          }
        } catch (error) {
          console.error('Error checking existing result for /api/problems:', error);
          return res.status(500).json({ success: false, message: '挑戦履歴の確認中にエラーが発生しました。' });
        }
      } else {
        console.log(`[Attempt Check] Skipped for admin user ID ${userId}.`);
      }
      // --- チェックここまで ---

      if (!searchDate) {
        searchDate = todayJST;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
        return res.status(400).json({ success: false, message: '日付の形式が無効です (YYYY-MM-DD)。' });
      }

      try {
        // ログメッセージにもusernameの代わりにuserIdを使用
        console.log(`[API] 問題取得リクエスト: 日付=${searchDate}, 難易度=${difficulty}, ユーザーID=${userId}`);
        const problemSet = await DailyProblemSet.findOne({ date: searchDate, difficulty });

        if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
          console.warn(`Problem set not found for ${searchDate} - ${difficulty}`);
          
          // 問題が見つからない場合、自動生成して保存（排他的に実行）
          const lockKey = `${searchDate}_${difficulty}`;
          
          // 別のリクエストが既に生成中かチェック
          if (problemGenerationLocks.has(lockKey)) {
            console.log(`[自動生成] ${searchDate}の${difficulty}難易度は別のプロセスが生成中です。待機します...`);
            
            // 2秒待機して再チェック
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryProblemSet = await DailyProblemSet.findOne({ date: searchDate, difficulty });
            
            if (retryProblemSet && retryProblemSet.problems && retryProblemSet.problems.length > 0) {
              console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題が別プロセスにより生成されました。`);
              
              // 生成された問題をクライアントに返す
              const clientProblems = retryProblemSet.problems.map(p => ({
                id: p.id, // ★ データベース内の問題IDを使用
                question: p.question,
              }));
              
              return res.json({
                success: true,
                difficulty: difficulty,
                date: searchDate,
                problems: clientProblems,
              });
            } else {
              return res.status(404).json({
                success: false,
                message: `${searchDate}の${difficulty}難易度の問題の生成に失敗しました。サポートにお問い合わせください。`
              });
            }
          }
          
          // ロックを取得
          problemGenerationLocks.set(lockKey, true);
          console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成を開始します（排他的実行）`);
          
          try {
            // 決定論的に問題を生成（日付と難易度から一貫したシード値を生成）
            const seed = `${searchDate}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const problems = generateProblems(difficulty, 10, seed);
            
            if (!problems || problems.length === 0) {
              throw new Error('問題生成に失敗しました');
            }
            
            // 生成した問題を保存
            const newProblemSet = new DailyProblemSet({
              date: searchDate,
              difficulty: difficulty,
              problems: problems.map(p => ({
                id: p.id,
                question: p.question,
                correctAnswer: p.answer,
                options: p.options
              }))
            });
            
            await newProblemSet.save();
            console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成完了（${problems.length}問）`);
            
            // 生成した問題をクライアントに返す
            const clientProblems = problems.map(p => ({ // problems は generateProblems から返るもの
              id: p.id, // ★ generateProblems が返す id を使用 (p.id が存在すると仮定)
              question: p.question,
            }));
            
            return res.json({
              success: true,
              difficulty: difficulty,
              date: searchDate,
              problems: clientProblems,
              autoGenerated: true
            });
          } catch (genError) {
            console.error(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成中にエラー:`, genError);
            console.error(genError.stack);  // スタックトレースも出力
            
            const message = searchDate === new Date().toISOString().split('T')[0]
                ? '本日の問題セットが見つかりません。管理者にお問い合わせください。'
                : `${searchDate}の問題セットが見つかりません。`;
            return res.status(404).json({ success: false, message: message });
          } finally {
            // 必ずロックを解放
            problemGenerationLocks.delete(lockKey);
            console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成ロックを解放しました`);
          }
        }

        // 問題が見つかった場合の処理
        console.log(`[API] 問題セットが見つかりました: ${searchDate} - ${difficulty}. 問題数: ${problemSet.problems.length}`);
        const clientProblems = problemSet.problems.map(p => ({
          id: p.id, // ★ データベース内の問題IDを使用
          question: p.question,
        }));

        res.json({
          success: true,
          difficulty: difficulty,
          date: searchDate,
          problems: clientProblems,
        });

      } catch (error) {
        console.error(`Error fetching problems for ${searchDate} - ${difficulty}:`, error);
        console.error(error.stack);  // スタックトレースも出力
        res.status(500).json({ 
          success: false, 
          message: '問題の取得中にエラーが発生しました。もう一度お試しいただくか、サポートにお問い合わせください。' 
        });
      }
    });

    app.post('/api/problems/submit', protect, async (req, res) => {
      // ★ リクエストボディから problemIds, answers, timeSpentMs を受け取る
      const { difficulty, date, problemIds, answers, timeSpentMs } = req.body;
      const userId = req.user._id;
      const isAdmin = req.user.isAdmin;

      console.log(`[Submit] Request received from user ID: ${userId}, isAdmin: ${isAdmin}`);
      console.log(`[Submit] Payload: difficulty=${difficulty}, date=${date}, problemIds_count=${problemIds?.length}, answers_count=${answers?.length}, timeSpentMs=${timeSpentMs}`);

      // ... (時間制限チェック、必須パラメータチェック、日付形式チェックは変更なし) ...
      if (process.env.DISABLE_TIME_CHECK !== 'true' && !isChallengeTimeAllowed()) {
        return res.status(403).json({ 
          success: false, 
          message: '挑戦可能な時間外です (毎日 6:30 - 8:00 JST)。',
          results: null
        });
      }

      if (!difficulty || !date || !problemIds || !Array.isArray(problemIds) || !answers || !Array.isArray(answers) || timeSpentMs === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: '無効なリクエストデータです。difficulty, date, problemIds, answers, timeSpentMs は必須です。',
          results: null 
        });
      }
      // ... (以降のチェックも同様)

      // ★ timeSpent (秒単位) を計算
      const timeSpentInSeconds = parseFloat((timeSpentMs / 1000).toFixed(3)); // 小数点以下3桁程度の精度で秒に変換

      // ... (1日1回提出チェックは変更なし) ...

      const calculateScore = (correctCount, totalProblems, timeInSec, difficulty) => {
        // ... (スコア計算ロジックは変更なし、timeInSec を使う) ...
        const difficultyMultiplier = {
          'beginner': 10,
          'intermediate': 15,
          'advanced': 20,
          'expert': 25
        };
        const basePointsPerCorrect = difficultyMultiplier[difficulty] || 10;
        let score = correctCount * basePointsPerCorrect;
        // 時間ボーナスは timeInSec を使う
        const standardTime = totalProblems * 30; // 1問30秒基準
        let timeBonus = 0;
        if (timeInSec < standardTime) {
          const timeSaved = standardTime - timeInSec;
          timeBonus = Math.min(50, Math.floor(timeSaved / 5));
        }
        const perfectBonus = (correctCount === totalProblems) ? 20 : 0;
        return score + timeBonus + perfectBonus;
      };

      try {
        // ★ DailyProblemSet から、送信された problemIds に対応する問題を取得
        //    注意: DailyProblemSet の problems 配列内の各問題が持つ識別子 (例: _id or id) と
        //    フロントから送られてくる problemIds の各要素が一致する必要がある。
        //    DailyProblemSet.problems の各要素が { question, correctAnswer, id } を持つと仮定。
        const problemSet = await DailyProblemSet.findOne({ date: date, difficulty: difficulty });

        if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
          return res.status(404).json({ success: false, message: `${date} の ${difficulty} 問題セットが見つかりません。`, results: null });
        }

        let correctCount = 0;
        let incorrectCount = 0;
        let unansweredCount = 0;
        const finalProblemResults = []; // ★ フロントに返す/DBに保存する詳細結果

        if (problemIds.length !== answers.length) {
          return res.status(400).json({ success: false, message: '問題IDの数と解答の数が一致しません。' });
        }

        for (let i = 0; i < problemIds.length; i++) {
          const problemIdFromClient = problemIds[i];
          const userAnswerStr = answers[i];
          
          // problemSet.problems から該当する problemId の問題を探す
          // DailyProblemSet の problems 配列の各要素が持つIDフィールド名に注意 (例: id, _id, problemId)
          // ここでは DailyProblemSet.problems の各要素が `id` (string型) を持つと仮定
          const originalProblem = problemSet.problems.find(p => p.id.toString() === problemIdFromClient.toString());

          if (!originalProblem) {
            console.error(`[Submit] Error: Original problem not found in DB for id: ${problemIdFromClient}`);
            // 見つからない場合はエラーとするか、スキップするか検討。今回はエラーとする。
            return res.status(400).json({ success: false, message: `ID ${problemIdFromClient} の問題がデータベースに見つかりません。` });
          }

          const correctAnswer = originalProblem.correctAnswer;
          const question = originalProblem.question;
          let userAnswerNum = null;
          let isCorrect = false;

          if (userAnswerStr === '' || userAnswerStr === null || userAnswerStr === undefined) {
            unansweredCount++;
          } else {
            userAnswerNum = parseFloat(userAnswerStr);
            if (isNaN(userAnswerNum)) {
                incorrectCount++;
            } else {
              const tolerance = 1e-9; // 浮動小数点比較のための許容誤差
                if (Math.abs(userAnswerNum - correctAnswer) < tolerance) {
                    correctCount++;
                    isCorrect = true;
                } else {
                    incorrectCount++;
                }
            }
          }

          finalProblemResults.push({
            problemId: problemIdFromClient, // フロントから送られたIDをそのまま使用
            question: question,
              userAnswer: userAnswerNum,
              correctAnswer: correctAnswer,
              isCorrect: isCorrect,
            // timeSpentPerProblem はここでは計算しない (必要なら別途)
          });
        }

        // ★ スコア計算には timeSpentInSeconds を使用
        const score = calculateScore(correctCount, problemIds.length, timeSpentInSeconds, difficulty);

        const resultsDataForDB = {
          totalProblems: problemIds.length,
            correctAnswers: correctCount,
            incorrectAnswers: incorrectCount,
            unanswered: unansweredCount,
          totalTime: timeSpentMs,       // ★ ミリ秒を保存
          timeSpent: timeSpentInSeconds,  // ★ 秒を保存
          problems: finalProblemResults,  // ★ 採点済みの詳細結果を保存
            score: score,
        };

        let user = await User.findById(userId).lean();
        if (!user) {
          return res.status(404).json({ success: false, message: 'ユーザー情報が見つかりません。' });
        }
        
        const resultToSave = {
          username: user.username,
            userId: user._id,
            difficulty: difficulty,
            date: date,
          timestamp: new Date(),
          ...resultsDataForDB,
        };

        // const savedResult = await Result.create(resultToSave); // ★ 修正前
        // ★ 修正後: userId と date をキーにして検索し、存在すれば更新、なければ新規作成 (upsert)
        const savedResult = await Result.findOneAndUpdate(
          { userId: user._id, date: date }, // 検索条件
          resultToSave,                     // 更新または挿入するデータ
          { 
            new: true, // 更新後のドキュメントを返す
            upsert: true, // ドキュメントが存在しない場合は作成する
            runValidators: true // スキーマバリデーションを実行
          }
        );
        console.log(`Result saved/updated for user ${user.username}, Result ID: ${savedResult._id}`);

        const resultForFrontend = {
          ...resultsDataForDB, // problems 配列もここに含まれる
          _id: savedResult._id,
          timestamp: savedResult.timestamp,
          username: user.username,
          userId: user._id,
          difficulty: difficulty,
          date: date,
        };

        res.json({
          success: true,
          message: '回答を正常に処理し、結果を保存しました。',
          results: resultForFrontend 
        });

      } catch (error) {
        console.error(`[Submit] Error processing submission:`, error);
        res.status(500).json({ success: false, message: '回答の処理または保存中にエラーが発生しました。', results: null });
      }
    });

    app.get('/api/rankings', (req, res) => {
      const users = [];
      const avatars = ['😊', '🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🐨', '🦁', '🐯'];
      
      for (let i = 0; i < 10; i++) {
        users.push({
          _id: `user-${i}`,
          username: `ユーザー${i + 1}`,
          avatar: avatars[i % avatars.length],
          grade: Math.floor(Math.random() * 6) + 1,
          points: Math.floor(Math.random() * 1000),
          streak: Math.floor(Math.random() * 10)
        });
      }
      
      res.json({
        success: true,
        users: users.sort((a, b) => b.points - a.points)
      });
    });

    // 日間ランキングAPI
    app.get('/api/rankings/daily', async (req, res) => {
      try {
        const { difficulty, grade } = req.query;
        const limit = parseInt(req.query.limit) || 10;
        
        console.log(`[DEBUG-RANKING] リクエストパラメータ:`, { difficulty, grade, limit });
        
        // 日付フィルターを一時的に無効化（すべてのデータを取得）
        const filter = {};
        if (difficulty) filter.difficulty = difficulty;
        if (grade) filter.grade = parseInt(grade);
        
        console.log(`[DEBUG-RANKING] 使用フィルター:`, filter);
        
        // 全データ確認用ログ
        const allResults = await Result.find({}).limit(20).lean();
        console.log(`[DEBUG-RANKING] データベース内のデータ (最大20件):`, 
          allResults.map(r => ({
            id: r._id.toString().substring(0, 8) + '...',
            username: r.username,
            userId: r.userId ? r.userId.toString().substring(0, 8) + '...' : 'none',
            date: r.date, 
            difficulty: r.difficulty,
            score: r.score
          }))
        );
        
        // Resultコレクションから取得
        const results = await Result.find(filter)
          .sort({ score: -1, timeSpent: 1 })
          .limit(limit)
          .lean();
        
        console.log(`[DEBUG-RANKING] Filter results:`, results.length);
        if (results.length > 0) {
          console.log(`[DEBUG-RANKING] First result:`, {
            username: results[0].username,
            userId: results[0].userId ? results[0].userId.toString().substring(0, 8) + '...' : 'none',
            score: results[0].score,
            date: results[0].date
          });
        }
        
        if (!results.length) {
          return res.json({
            success: true,
            message: 'まだランキングデータがありません',
            rankings: []
          });
        }
        
        // ユーザー情報を取得
        // 1. まずuserIdでユーザーを検索
        const userIds = [...new Set(results
          .filter(r => r.userId) // userIdがあるものだけ抽出
          .map(r => r.userId.toString())
        )];
        console.log(`[Ranking] Unique userIds to lookup:`, userIds.length);
        
        const usersByIdMap = new Map();
        if (userIds.length > 0) {
          const usersById = await User.find({ _id: { $in: userIds } }).lean();
          console.log(`[Ranking] Found ${usersById.length} users by ID`);
          
          // IDをキーとするマップに変換
          usersById.forEach(user => {
            usersByIdMap.set(user._id.toString(), user);
          });
        }
        
        // 2. userIdで見つからなかったユーザーをusernameで検索
        const usernamesToLookup = results
          .filter(r => !r.userId || !usersByIdMap.has(r.userId.toString()))
          .map(r => r.username);
        
        const uniqueUsernames = [...new Set(usernamesToLookup)];
        console.log(`[Ranking] Additional usernames to lookup:`, uniqueUsernames.length);
        
        const usersByNameMap = new Map();
        if (uniqueUsernames.length > 0) {
          const usersByName = await User.find({ username: { $in: uniqueUsernames } }).lean();
          console.log(`[Ranking] Found ${usersByName.length} users by username`);
          
          // ユーザー名をキーとするマップに変換
          usersByName.forEach(user => {
            usersByNameMap.set(user.username, user);
          });
        }
        
        // ランキング情報をユーザー情報と組み合わせる
        const rankings = results.map((result, index) => {
          // 1. まずuserIdでユーザーを検索
          let user = null;
          if (result.userId) {
            user = usersByIdMap.get(result.userId.toString());
          }
          
          // 2. userIdで見つからない場合はusernameで検索
          if (!user) {
            user = usersByNameMap.get(result.username);
          }
          
          // 3. それでも見つからない場合は最低限の情報を使用
          const avatar = user?.avatar || '👤';
          const grade = result.grade || user?.grade || 1;
          
          return {
            rank: index + 1,
            username: result.username,
            avatar: avatar,
            grade: grade,
            score: result.score,
            timeSpent: result.timeSpent,
            correctAnswers: result.correctAnswers,
            totalProblems: result.totalProblems || 10,
            incorrectAnswers: result.incorrectAnswers || 0,
            unanswered: result.unanswered || 0,
            totalTime: result.totalTime || result.timeSpent * 1000,
            difficulty: result.difficulty,
            date: result.date
          };
        });
        
        // レスポンス形式の改善 - フロントエンドが期待する形式に合わせる
        res.json({
          success: true,
          date: new Date().toISOString().split('T')[0],
          message: rankings.length ? null : 'まだランキングデータがありません',
          rankings: rankings
        });
      } catch (error) {
        console.error('[API] Error getting daily rankings:', error);
        res.status(500).json({ 
          success: false, 
          message: 'ランキングの取得中にエラーが発生しました' 
        });
      }
    });
    
        // ★ ユーザー履歴取得ルート
        app.get('/api/history', protect, async (req, res) => {
          const userId = req.user._id;
          // ★ req.query.limit の型チェックとデフォルト値設定を修正
          let limit = 10; // デフォルト値
          if (req.query.limit && typeof req.query.limit === 'string') {
            const parsedLimit = parseInt(req.query.limit, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
              limit = parsedLimit;
            }
          }
          // TODO: ページネーション
          // let page = 1;
          // if (req.query.page && typeof req.query.page === 'string') {
          //   const parsedPage = parseInt(req.query.page, 10);
          //   if (!isNaN(parsedPage) && parsedPage > 0) {
          //     page = parsedPage;
          //   }
          // }
          // const skip = (page - 1) * limit;

          console.log(`[API] GET /api/history request for user: ${userId}, limit: ${limit}`);

          try {
            const historyResults = await Result.find({ userId: userId })
              .sort({ timestamp: -1 }) // 新しい順にソート
          .limit(limit)
              // .skip(skip) // ページネーション用
              .lean(); // lean() で Mongoose ドキュメントではなく軽量な JS オブジェクトを取得

            // TODO: ページネーション情報を取得する場合
            // const totalItems = await Result.countDocuments({ userId: userId });
            // const totalPages = Math.ceil(totalItems / limit);

            console.log(`[API] Found ${historyResults.length} history items for user ${userId}`);
        
        res.json({
          success: true,
              message: '履歴を取得しました。',
              history: historyResults,
              // pagination: { // ページネーション用
              //   currentPage: page,
              //   totalPages: totalPages,
              //   totalItems: totalItems
              // }
            });
      } catch (error) {
            console.error(`[API] Error fetching history for user ${userId}:`, error);
        res.status(500).json({ 
          success: false, 
              message: '履歴の取得中にサーバーエラーが発生しました。' 
        });
      }
    });

    // ★ 管理者用: 問題生成ルート
    // POST /api/problems/generate
    app.post('/api/problems/generate', protect, admin, async (req, res) => {
      const { date, difficulty, forceOverwrite } = req.body;

      if (!date || !difficulty) {
        return res.status(400).json({ success: false, message: '日付と難易度を指定してください。' });
      }

      try {
        const existingSet = await DailyProblemSet.findOne({ date, difficulty });
        
        if (existingSet) {
          if (forceOverwrite === true) {
            console.log(`[API Generate] Force overwriting existing problem set for ${date} - ${difficulty}`);
            await DailyProblemSet.deleteOne({ date, difficulty });
            console.log(`[API Generate] Existing problem set deleted.`);
          } else {
            return res.status(400).json({ success: false, message: `${date} の ${difficulty} 難易度の問題セットは既に存在します。編集機能を使うか、既存のセットを削除してください。 (強制上書きするにはチェックを入れてください)` });
          }
        }

        const seed = `${date}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const problems = await generateProblemsUtil(difficulty, 10, seed);
        
        if (!problems || problems.length === 0) {
          console.error(`[API Generate] ${date}の${difficulty}難易度の問題生成に失敗しました。`);
          return res.status(500).json({ success: false, message: '問題の生成に失敗しました。' });
        }

        const newProblemSet = new DailyProblemSet({
          date,
          difficulty,
              problems: problems.map(p => ({
            id: p.id,
                question: p.question,
                correctAnswer: p.answer,
                options: p.options,
              })),
        });

        await newProblemSet.save();
        console.log(`[API Generate] ${date}の${difficulty}難易度の問題が管理者によって生成されました（${problems.length}問）`);
            res.status(201).json({
                success: true,
          message: `${date} の ${difficulty} 難易度の問題が ${problems.length} 件生成されました。`,
          problemSet: newProblemSet,
        });
        } catch (error) {
        console.error(`[API Generate] Error generating problems for ${date} - ${difficulty}:`, error);
        res.status(500).json({ success: false, message: '問題生成中にサーバーエラーが発生しました。', error: error.message });
      }
    });

    // @desc    指定された日付と難易度の問題セットを取得 (編集用)
    // @route   GET /api/problems/edit
    // @access  Private/Admin
    app.get('/api/problems/edit', protect, admin, async (req, res) => {
      try {
      const { date, difficulty } = req.query;
      
        if (!date || !difficulty) {
          return res.status(400).json({ success: false, message: '日付と難易度を指定してください。' });
        }

        const problemSet = await DailyProblemSet.findOne({ date: date, difficulty: difficulty });

        if (!problemSet) {
          return res.status(404).json({ success: false, message: '指定された日付と難易度の問題セットは見つかりません。' });
        }
        // 追加: DBから取得した問題セットの内容をログに出力
        console.log('DEBUG: problemSet.problems from DB:', JSON.stringify(problemSet.problems, null, 2));

        const problemsToReturn = problemSet.problems.map((p, index) => ({
          id: p.id, 
            question: p.question,
            correctAnswer: p.correctAnswer,
          options: p.options,
        }));
        // 追加: フロントエンドに返す問題セットの内容をログに出力
        console.log('DEBUG: problemsToReturn for frontend:', JSON.stringify(problemsToReturn, null, 2));
        
        res.json({
          success: true,
          problems: problemsToReturn,
          message: `${problemsToReturn.length}件の問題を読み込みました。`
        });

      } catch (error) {
        console.error('Error fetching problems for edit:', error);
        res.status(500).json({ success: false, message: '問題の取得中にサーバーエラーが発生しました。', error: error.message });
      }
    });

    // @desc    指定された日付と難易度の問題セットを更新 (編集用)
    // @route   POST /api/problems/edit
    // @access  Private/Admin
    app.post('/api/problems/edit', protect, admin, async (req, res) => {
      try {
        const { date, difficulty, problems: updatedProblems } = req.body;

        if (!date || !difficulty || !Array.isArray(updatedProblems)) {
          return res.status(400).json({ success: false, message: '日付、難易度、問題配列を指定してください。' });
        }

        const problemSet = await DailyProblemSet.findOne({ date, difficulty });

        if (!problemSet) {
          return res.status(404).json({ success: false, message: '指定された日付と難易度の問題セットは見つかりません。新規作成は問題生成ルートを使用してください。' });
        }

        // 送られてきた問題配列で既存の問題を更新
        // 注意: この実装では、送信された問題配列の順番と内容で完全に上書きします。
        // IDが一致しない問題は消え、新しい問題が追加される可能性があります。
        // より堅牢にするには、各問題のIDに基づいてマージするなどの処理が必要ですが、
        // まずはフロントエンドからのデータで上書きするシンプルな実装とします。
        problemSet.problems = updatedProblems.map(p => ({
          id: p.id || uuidv4(), // フロントからIDが来ていればそれを使用、なければ新規生成 (ただし、既存IDは必須とすべき)
          question: p.question,
          correctAnswer: p.correctAnswer,
          options: p.options || [], // optionsがなくてもエラーにならないように
        }));
        problemSet.isEdited = true; // 編集済みフラグ

        await problemSet.save();

        res.json({ 
          success: true, 
          message: '問題セットを正常に更新しました。',
          count: problemSet.problems.length,
          problemSet // 更新後の問題セットを返す (任意)
        });

      } catch (error) {
        console.error('Error updating problems for edit:', error);
        // Mongooseのバリデーションエラーなどもここでキャッチされる
        if (error.name === 'ValidationError') {
          return res.status(400).json({ success: false, message: 'データの検証に失敗しました。', errors: error.errors });
        }
        res.status(500).json({ success: false, message: '問題の更新中にサーバーエラーが発生しました。', error: error.message });
      }
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
