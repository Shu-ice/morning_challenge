const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// 環境変数の読み込み
dotenv.config();

// データベース接続
connectDB();

// ルーターのインポート
const authRoutes = require('./routes/authRoutes');
const problemRoutes = require('./routes/problemRoutes');
const resultRoutes = require('./routes/resultRoutes');
const rankingRoutes = require('./routes/rankingRoutes');

// Expressアプリの初期化
const app = express();

// ミドルウェアの設定
app.use(cors());
app.use(express.json());

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
app.listen(PORT, () => {
  console.log(`サーバーが${PORT}番ポートで起動しました（${process.env.NODE_ENV}モード）`);
});

// 未処理のPromise拒否イベントのハンドリング
process.on('unhandledRejection', (err) => {
  console.error('未処理のPromise拒否:', err);
  // サーバーをクラッシュさせる（PM2などで自動再起動させる設計を想定）
  // process.exit(1);
});