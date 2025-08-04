# Railway.app クイック環境変数設定

## 🚀 コピー&ペースト用設定

### 基本設定（必須）
```
NODE_ENV=production
PORT=3000
MONGODB_MOCK=false
JWT_SECRET=morning-challenge-2025-super-secure-jwt-secret-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@example.com
ADMIN_DEFAULT_PASSWORD=MorningChallenge2025!
DISABLE_TIME_CHECK=false
LOG_LEVEL=info
```

### MongoDB URI（要変更）
```
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/morning_challenge?retryWrites=true&w=majority
```

## 📋 設定手順

### Railway.app Variables画面で1つずつ追加:

1. **MONGODB_MOCK**
   - Name: `MONGODB_MOCK`
   - Value: `false`

2. **NODE_ENV**
   - Name: `NODE_ENV`
   - Value: `production`

3. **PORT**
   - Name: `PORT`
   - Value: `3000`

4. **JWT_SECRET**
   - Name: `JWT_SECRET`
   - Value: `morning-challenge-2025-super-secure-jwt-secret-key-minimum-32-characters-long`

5. **管理者設定**
   - Name: `ADMIN_EMAIL`
   - Value: `admin@example.com`
   - Name: `ADMIN_DEFAULT_PASSWORD`
   - Value: `MorningChallenge2025!`

6. **MongoDB URI**
   - Name: `MONGODB_URI`
   - Value: あなたの実際の接続文字列

## ⚡ 設定完了後
1. **Redeploy** ボタンをクリック
2. **Deployment logs** でエラーが解消されることを確認
3. 生成されたURLにアクセスしてアプリが動作することを確認