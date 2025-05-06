const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// 環境変数の読み込み
dotenv.config();

// 時間チェック設定の確認とログ出力
const isTimeCheckDisabled = process.env.DISABLE_TIME_CHECK === 'true';
console.log(`時間チェック設定: ${isTimeCheckDisabled ? '無効（すべての時間でアクセス可能）' : '有効（朝6:30〜8:00のみアクセス可能）'}`);

// データベース接続
connectDB();

// ルーターのインポート
const authRoutes = require('./routes/authRoutes');
const problemRoutes = require('./routes/problemRoutes');
const resultRoutes = require('./routes/resultRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const historyRoutes = require('./routes/historyRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Expressアプリの初期化
const app = express();

// タイムアウト設定（2分 = 120秒）
const serverTimeout = 120 * 1000;
app.timeout = serverTimeout;

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

// サーバーの起動
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`サーバーが${PORT}番ポートで起動しました（${process.env.NODE_ENV}モード）`);
  console.log(`サーバータイムアウト: ${serverTimeout / 1000}秒`);
});

// サーバーのタイムアウト設定
server.timeout = serverTimeout;

// 未処理のPromise拒否イベントのハンドリング
process.on('unhandledRejection', (err) => {
  console.error('未処理のPromise拒否:', err);
  // サーバーをクラッシュさせる（PM2などで自動再起動させる設計を想定）
  // process.exit(1);
});