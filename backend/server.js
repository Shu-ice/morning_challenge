import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import User from './models/User.js';

// 環境変数の読み込み
dotenv.config();

// 時間チェック設定の確認とログ出力
const isTimeCheckDisabled = process.env.DISABLE_TIME_CHECK === 'true';
console.log(`時間チェック設定: ${isTimeCheckDisabled ? '無効（すべての時間でアクセス可能）' : '有効（朝6:30〜8:00のみアクセス可能）'}`);

// データベース接続
connectDB();

// ルーターのインポート
import authRoutes from './routes/authRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import resultRoutes from './routes/resultRoutes.js';
import rankingRoutes from './routes/rankingRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Expressアプリの初期化
const app = express();

// タイムアウト設定（2分 = 120秒）
const serverTimeout = 120 * 1000;
// app.timeout = serverTimeout; // app.listen後に設定するため一旦コメントアウト

// ★ 管理者アカウントを保証する関数
async function ensureAdminUser() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    // ADMIN_USERNAMEがなければemailの@より前を使うか、'admin'をデフォルトに
    const defaultAdminUsername = adminEmail.split('@')[0] || 'admin';
    const adminUsername = process.env.ADMIN_USERNAME || defaultAdminUsername;

    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      console.log(`[Init] Admin user '${adminEmail}' not found. Creating new admin user with username '${adminUsername}'.`);
      adminUser = await User.create({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword, // パスワードはモデルのフックでハッシュ化される想定
        isAdmin: true,
        // grade: 0, // ★ 管理者にはgradeを設定しない、またはスキーマに合う値を設定
      });
      console.log(`[Init] New admin user '${adminEmail}' (username: '${adminUsername}') created successfully. ID: ${adminUser._id}`);
    } else {
      console.log(`[Init] Admin user '${adminEmail}' (username: '${adminUser.username}') already exists.`);
      // 既存の管理者のisAdminフラグがfalseになっていたらtrueに更新（念のため）
      if (!adminUser.isAdmin) {
        adminUser.isAdmin = true;
        await adminUser.save();
        console.log(`[Init] Updated existing admin user '${adminEmail}' to ensure isAdmin is true.`);
      }
    }
  } catch (error) {
    console.error('[Init] Error ensuring admin user:', error);
    // ここでプロセスを終了させるとサーバーが起動しないため、エラーログのみに留める
    // process.exit(1);
  }
}

// ミドルウェアの設定
// CORS設定を更新: 複数の開発用オリジンと資格情報を許可
const allowedOrigins = ['http://localhost:3004', 'http://localhost:3005', 'http://localhost:3007', 'http://localhost:3008']; // 3004も追加
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      // エラーをコールバックで渡し、処理を続行させない
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // クッキーなどの資格情報の送受信を許可
}));

// リクエストのボディサイズ制限を増加（デフォルトの100kBから10MBに）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// リクエストのログ記録（開発環境のみ）
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// ルートの設定
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/results', resultRoutes);

app.use('/api/rankings', rankingRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminRoutes);

// 新しいAPIヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// 基本的なヘルスチェックエンドポイント
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '朝の計算チャレンジAPIサーバーが稼働中です',
    version: '1.0.0'
  });
});

// 存在しないルートへのアクセス処理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '要求されたリソースが見つかりません'
  });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  
  res.status(500).json({
    success: false,
    error: '内部サーバーエラーが発生しました'
  });
});

// ★ サーバー起動処理を非同期関数でラップ
async function startServer() {
  try {
    await connectDB(); // DB接続を待つ
    await ensureAdminUser(); // 管理者アカウントの確認/作成を待つ

    const PORT = process.env.PORT || 5001;
    const serverInstance = app.listen(PORT, () => { // listenの戻り値をserverInstanceに
      console.log(`サーバーが${PORT}番ポートで起動しました（${process.env.NODE_ENV || 'not set'}モード）`);
      console.log(`サーバータイムアウト: ${serverTimeout / 1000}秒`);
    });

    // サーバーのタイムアウト設定
    serverInstance.timeout = serverTimeout; // app.listenの戻り値に設定

  } catch (error) {
    console.error('サーバー起動に失敗しました:', error);
    process.exit(1);
  }
}

// サーバー起動
startServer();

// 未処理のPromise拒否イベントのハンドリング
process.on('unhandledRejection', (err) => {
  console.error('未処理のPromise拒否:', err);
  // サーバーをクラッシュさせる（PM2などで自動再起動させる設計を想定）
  // process.exit(1);
});