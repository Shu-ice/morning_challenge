# Vercel デプロイ & テスト手順

## 🚀 デプロイ手順

### 1. GitHubへプッシュ
```bash
# 認証設定（必要に応じて）
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 変更をプッシュ
git push origin master
```

### 2. Vercel自動デプロイ
- GitHubへのプッシュ後、Vercelが自動的にデプロイを開始
- デプロイ時間: 約2-5分
- 完了後、新しいバージョンが本番環境に反映

## 🧪 テスト手順

### Phase 1: 基本動作確認
```bash
# 1. ヘルスチェック
curl https://morningchallenge-r8w69gzgm-shu-ices-projects.vercel.app/api/health

# 2. 環境変数確認
curl https://morningchallenge-r8w69gzgm-shu-ices-projects.vercel.app/api/test/env-test

# 3. MongoDB接続テスト
curl https://morningchallenge-r8w69gzgm-shu-ices-projects.vercel.app/api/test/mongodb-test
```

### Phase 2: 管理者ログインテスト

#### 方法1: ブラウザで直接テスト
1. https://morningchallenge-r8w69gzgm-shu-ices-projects.vercel.app にアクセス
2. ログインページで以下の認証情報を使用:
   - **Email**: `admin@example.com`
   - **Password**: `admin123`
3. 成功すると管理者ダッシュボードへリダイレクト

#### 方法2: APIテスト
```bash
# ログインAPIテスト
curl -X POST https://morningchallenge-r8w69gzgm-shu-ices-projects.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### Phase 3: テストスクリプト実行
```bash
# 修正版テストスクリプト実行
node test-vercel-fix.js
```

## 🔧 修正内容

### 解決したエラー
- ❌ **FUNCTION_INVOCATION_FAILED** → ✅ **正常な認証フロー**

### 主な修正点
1. **vercel.json**: タイムアウト 20秒→30秒
2. **database.js**: MongoDB接続最適化
3. **app.js**: 接続タイムアウト保護 (15秒)
4. **api/express.js**: シンプルハンドラー構造

## 📋 期待される結果

### 成功時の動作
- ✅ API エンドポイントが正常に応答
- ✅ MongoDB Atlas接続成功
- ✅ `admin@example.com` でログイン成功
- ✅ 管理者権限 (isAdmin: true) の確認

### エラー時の対処
- **401認証エラー**: Vercelの認証設定が有効（正常）
- **500エラー**: ログでMongoDB接続状況を確認
- **タイムアウト**: 再度アクセスを試行

## 🎯 次のステップ

1. **デプロイ完了確認**: Vercelダッシュボードで確認
2. **基本テスト実行**: 上記Phase 1-3を順次実行
3. **管理者機能テスト**: ログイン後の管理画面動作確認
4. **本番環境検証**: 実際のユーザー体験をテスト

---

**重要**: 初回デプロイ後は、Vercel環境変数の設定も確認してください：
- MONGODB_URI
- JWT_SECRET
- NODE_ENV=production