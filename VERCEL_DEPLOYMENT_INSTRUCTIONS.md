# 🚀 Vercel 本番環境デプロイ手順

## 📋 前提条件

- Vercel アカウントの作成
- GitHub リポジトリとの連携
- MongoDB Atlas データベースの準備

## 🔧 Vercel プロジェクト設定

### 1. Vercel でプロジェクトをインポート

1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. "New Project" をクリック
3. GitHub リポジトリを選択
4. プロジェクト名: `morning-math-challenge`

### 2. Environment Variables の設定

Vercel Dashboard → Settings → Environment Variables で以下を設定：

#### 必須環境変数

```bash
# MongoDB
MONGODB_URI=mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng

# JWT認証
JWT_SECRET=your-super-secure-jwt-secret-key-for-production

# 実行環境
NODE_ENV=production
MONGODB_MOCK=false
DISABLE_TIME_CHECK=false

# フロントエンド設定
FRONTEND_URL=https://morning-challenge.vercel.app

# セキュリティ
CORS_ORIGIN=https://morning-challenge.vercel.app

# タイムゾーン
TZ=Asia/Tokyo
```

## 🏗️ Build & Deploy 設定

### 1. Build コマンド確認

Vercel は自動的に以下を実行：

```bash
# Install
npm install --legacy-peer-deps --include=dev

# Build  
npm run build:production
```

### 2. Output Directory

- Output Directory: `dist`
- Install Command: `npm install --legacy-peer-deps --include=dev`
- Build Command: `npm run build:production`

## 🌐 API ルーティング設定

### 現在の API エンドポイント

✅ 実装済み：
- `/api/rankings` - ランキング取得
- `/api/admin-stats` - 管理者統計
- `/api/monitoring` - システム監視
- `/api/history` - 履歴取得
- `/api/problems` - 問題関連
- `/api/auth/login` - ログイン
- `/api/auth/register` - ユーザー登録
- `/api/users/profile` - プロフィール
- `/api/admin/users` - ユーザー管理 ✨ 新規
- `/api/admin/users/[userId]/make-admin` - 管理者権限付与 ✨ 新規
- `/api/admin/users/[userId]/remove-admin` - 管理者権限削除 ✨ 新規
- `/api/system/status` - システム状態監視 ✨ 新規

### SPA ルーティング対応

`vercel.json` の `rewrites` 設定により、以下が解決：

✅ **問題**: `/admin` をハードリロードすると 404  
✅ **解決**: すべて `/index.html` にリダイレクト

## 🧪 デプロイ前チェックリスト

### 1. ローカルテスト

```bash
# 本番環境モードでビルド
npm run build:production

# プレビュー確認
npm run preview
```

### 2. API エンドポイントテスト

本番デプロイ後、以下をテスト：

```bash
# 健康チェック
curl https://morning-challenge.vercel.app/api/rankings

# 管理者API（要認証）
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://morning-challenge.vercel.app/api/admin/users
```

## 🚨 トラブルシューティング

### 問題 1: API が 404 を返す

**原因**: Serverless Functions の設定問題  
**解決**: `vercel.json` の `functions` 設定を確認

### 問題 2: 管理画面リロードで 404

**原因**: SPA ルーティング未設定  
**解決**: `vercel.json` の `rewrites` で `/index.html` にフォールバック

### 問題 3: MongoDB 接続エラー

**原因**: 環境変数の設定不備  
**解決**: Vercel Dashboard で `MONGODB_URI` を確認

### 問題 4: CORS エラー

**原因**: オリジン設定の問題  
**解決**: `CORS_ORIGIN` 環境変数とコード内の設定を統一

## 📊 監視とメンテナンス

### 1. Vercel Analytics

- Function logs の確認
- Performance metrics の監視
- Error tracking の設定

### 2. システムヘルス監視

管理者ダッシュボードの System Health パネルで：

- データベース接続状態
- メモリ使用量
- エラー発生状況
- パフォーマンス指標

### 3. 定期メンテナンス

- ログの定期確認
- 環境変数の更新
- セキュリティパッチの適用
- データベースのバックアップ確認

## ✅ 受け入れテスト

デプロイ完了後、以下を確認：

1. **フロントエンド**:
   - `/` - ホームページ表示
   - `/admin` - 管理ダッシュボード表示（リロード含む）
   - `/login` - ログイン機能

2. **API エンドポイント**:
   - `/api/rankings` - ランキング取得
   - `/api/admin/users` - ユーザー一覧（認証必要）
   - `/api/system/status` - システム状態（認証必要）

3. **認証・権限**:
   - ログイン/ログアウト
   - 管理者権限の確認
   - JWT トークンの動作

## 🎯 次のステップ

デプロイ成功後：

1. ユーザーテストの実施
2. パフォーマンス最適化
3. セキュリティ強化
4. 監視体制の確立
5. CI/CD パイプラインの改善