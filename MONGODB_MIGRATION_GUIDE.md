# MongoDB Atlas → Railway.app 移行ガイド

## 🔄 既存設定から変更が必要な箇所

### 1. データベースユーザー変更

#### 現在の設定を確認
1. [MongoDB Atlas](https://cloud.mongodb.com) にログイン
2. プロジェクト選択 → クラスター選択
3. "Database Access" タブをクリック
4. 現在のユーザー一覧を確認（`vercel-admin-user` が存在するはず）

#### 新しいユーザー作成
1. "Add New Database User" をクリック
2. 設定:
   ```
   Authentication Method: Password
   Username: railway-admin-user
   Password: [Generate Strong Password] ← 新しいパスワード
   Database User Privileges: Read and write to any database
   ```
3. "Add User" をクリック
4. **パスワードをメモ帳に保存**（重要！）

### 2. ネットワークアクセス変更

#### 現在の設定を確認
1. "Network Access" タブをクリック
2. 現在のIP許可リストを確認

#### Railway.app用アクセス追加
1. "Add IP Address" をクリック
2. 設定:
   ```
   Access List Entry: 0.0.0.0/0
   Comment: Railway.app and development access
   ```
3. "Confirm" をクリック

**注意**: 0.0.0.0/0 は全てのIPを許可します。本番環境では、Railway.appの特定IPに制限することを推奨。

### 3. 新しい接続文字列取得

#### 接続文字列取得
1. クラスター一覧で "Connect" をクリック
2. "Drivers" を選択
3. Driver: Node.js, Version: 4.1 or later
4. 接続文字列をコピー:
   ```
   mongodb+srv://railway-admin-user:<password>@your-cluster.mongodb.net/?retryWrites=true&w=majority
   ```
5. `<password>` を Step 1で作成したパスワードに置換

### 4. データベース名の変更（推奨）

#### 現在のデータベース名
- Vercel統合時のデフォルト: `myFirstDatabase`

#### 推奨データベース名
- アプリ専用: `morning_challenge`

#### 接続文字列の最終形
```
mongodb+srv://railway-admin-user:YOUR_NEW_PASSWORD@your-cluster.mongodb.net/morning_challenge?retryWrites=true&w=majority
```

## 🚀 Railway.app での設定

### 環境変数設定
Railway.app プロジェクトの Variables タブで:

```bash
MONGODB_URI=mongodb+srv://railway-admin-user:YOUR_NEW_PASSWORD@your-cluster.mongodb.net/morning_challenge?retryWrites=true&w=majority
MONGODB_MOCK=false
```

## ✅ 動作確認手順

### 1. デプロイ実行
Railway.app で再デプロイを実行

### 2. ログ確認
```
✅ MongoDB サーバーに接続しました: mongodb+srv://railway-admin-user:***@your-cluster.mongodb.net
```

### 3. アプリケーション確認
- ヘルスチェック: `/api/health`
- 管理者ログイン動作確認

## 🔒 セキュリティ考慮事項

### 不要なユーザー削除（オプション）
移行完了後、Vercel用ユーザーを削除:
1. Database Access → vercel-admin-user
2. "Delete" をクリック

### IP制限の強化（本番環境推奨）
Railway.appの実際のIPアドレスが分かり次第、0.0.0.0/0から変更することを推奨

## 📊 費用への影響

- MongoDB Atlas: **変更なし**（同じクラスター使用）
- 接続数: **変更なし**（Railway.app 1接続のみ）
- データ転送: **同等またはそれ以下**