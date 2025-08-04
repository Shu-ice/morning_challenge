# Railway.app デプロイガイド

## 🚀 クイックデプロイ

### 1. Railway.appアカウント作成
1. [Railway.app](https://railway.app) にアクセス
2. GitHub アカウントでサインアップ
3. プロジェクト作成

### 2. デプロイ設定

#### GitHub連携
1. Railway.app で "New Project" → "Deploy from GitHub repo"
2. このリポジトリを選択
3. 自動デプロイ設定完了

#### 環境変数設定
Railway.app のプロジェクト設定で以下を設定：

```bash
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/morning_challenge
MONGODB_MOCK=false
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@example.com
ADMIN_DEFAULT_PASSWORD=ChangeThisPassword123!
DISABLE_TIME_CHECK=false
LOG_LEVEL=info
```

### 3. MongoDB Atlas設定

1. [MongoDB Atlas](https://cloud.mongodb.com) でクラスター作成
2. Database User を作成
3. Network Access で 0.0.0.0/0 を許可
4. Connection String を環境変数 `MONGODB_URI` に設定

### 4. デプロイ確認

1. Railway.app でデプロイログを確認
2. 生成されたURLにアクセス
3. `/api/health` で正常性確認

## 🔧 トラブルシューティング

### ビルドエラー
- `npm run build:production` が失敗する場合は環境変数を確認
- Node.js バージョンは18.x推奨

### 接続エラー
- MongoDB Atlas の Network Access を確認
- Connection String の書式を確認

### アプリが起動しない
- Railway.app のログでエラー詳細を確認
- PORT 環境変数が正しく設定されているか確認

## 📊 パフォーマンス

- 初回アクセス: ~500ms
- 通常アクセス: ~200ms
- 自動スケーリング対応
- 10分間非アクティブで自動スリープ

## 💰 料金

- 無料: 月500時間まで
- 有料: $5/月から
- 使用した分だけ課金

## 🔄 更新方法

1. GitHubにpush
2. Railway.appが自動でデプロイ
3. 数分で反映完了