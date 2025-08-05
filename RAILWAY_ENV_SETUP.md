# Railway デプロイ用環境変数設定

## 必須環境変数

Railway ダッシュボードの Variables タブで以下を設定してください：

### セキュリティ設定
```
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=30d
```

### 管理者設定
```
ADMIN_EMAIL=admin@yourmail.com
ADMIN_DEFAULT_PASSWORD=SecurePassword123!
```

### データベース設定
```
MONGODB_URI=mongodb+srv://railway-admin-user:31415926535@cluster.mongodb.net/morning_challenge
MONGODB_MOCK=false
```

### アプリケーション設定
```
NODE_ENV=production
LOG_LEVEL=info
DISABLE_TIME_CHECK=false
```

## 設定手順

1. Railway ダッシュボードにログイン
2. プロジェクトを選択
3. **Variables** タブを開く
4. 上記の環境変数を一つずつ追加
5. **Deploy** ボタンでデプロイを再実行

## セキュリティ注意事項

- `JWT_SECRET` は32文字以上の強力なランダム文字列を使用
- `ADMIN_DEFAULT_PASSWORD` は8文字以上で複雑なパスワードを設定
- 本番環境では必ず `MONGODB_MOCK=false` に設定

## トラブルシューティング

環境変数設定後もエラーが出る場合：

1. Railway プロジェクトの **Deployments** タブで最新のログを確認
2. 環境変数の値に誤字がないかチェック
3. 必要に応じて `npm run build` を再実行