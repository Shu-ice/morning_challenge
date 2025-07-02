# 🚀 Vercel デプロイメント完全ガイド

## 📋 概要

この文書では、Morning Math Challenge アプリケーションを Vercel に安全かつ確実にデプロイする手順を説明します。

## 🎯 解決済みの問題

✅ **環境変数不足によるビルド失敗**  
✅ **Express API の 404 エラー**  
✅ **SPA ルーティングの問題**  
✅ **管理画面のリロード 404**  

## 🏗️ アーキテクチャ

```
morning-challenge/
├── api/                    # Vercel Serverless Functions
│   ├── admin/users.js      # 管理者ユーザー管理API
│   ├── system/status.js    # システム監視API
│   └── ...                 # その他のAPI
├── src/                    # React フロントエンド
├── dist/                   # ビルド出力 (Vercel Static)
└── vercel.json            # Vercel設定
```

## 📊 環境変数早見表

### 🔴 本番環境 (Production)

| 変数名 | 必須 | 説明 | 設定値例 |
|--------|------|------|----------|
| `NODE_ENV` | ★ | 実行環境 | `production` |
| `MONGODB_MOCK` | ★ | モック使用 | `false` (本番は実DB) |
| `MONGODB_URI` | ★ | MongoDB接続 | `mongodb+srv://...` |
| `JWT_SECRET` | ★ | JWT署名キー | 64文字以上のランダム文字列 |
| `ADMIN_EMAIL` | ★ | 管理者メール | `admin@yourcompany.com` |
| `ADMIN_DEFAULT_PASSWORD` | ★ | 管理者パスワード | 強力なパスワード |

### 🟡 プレビュー環境 (Preview)

| 変数名 | 必須 | 設定値 |
|--------|------|--------|
| `NODE_ENV` | ★ | `preview` |
| `MONGODB_MOCK` | ★ | `true` |
| `JWT_SECRET` | ☆ | ダミー値でOK |
| その他 | ☆ | 不要（自動設定） |

### 🟢 ローカル開発環境

| 変数名 | 設定値 |
|--------|--------|
| `NODE_ENV` | `development` |
| `MONGODB_MOCK` | `true` |
| `JWT_SECRET` | 32文字以上の任意文字列 |

## 🔧 デプロイ手順

### 1. Vercel プロジェクト作成

```bash
# Vercel CLI インストール
npm i -g vercel

# プロジェクト初期化
vercel login
vercel --prod
```

### 2. 環境変数設定

#### Vercel Dashboard での設定

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. プロジェクト → Settings → Environment Variables

**Production 環境**:
```bash
NODE_ENV=production
MONGODB_MOCK=false
MONGODB_URI=mongodb+srv://your-user:your-password@cluster.mongodb.net/your-db
JWT_SECRET=your-super-secure-64-character-random-string-for-production-use
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_DEFAULT_PASSWORD=YourSecurePassword123!
```

**Preview 環境**:
```bash
NODE_ENV=preview
MONGODB_MOCK=true
```

### 3. 自動デプロイ設定

GitHub リポジトリと連携済みの場合、以下で自動デプロイ:

```bash
# main ブランチにプッシュ → 本番デプロイ
git push origin main

# PR 作成 → プレビューデプロイ
git checkout -b feature/new-feature
git push origin feature/new-feature
# PR 作成
```

## 🧪 ビルド検証

### ローカルでのテスト

```bash
# 環境変数検証テスト
npm run test:env

# Vercel ビルドテスト
npm run test:build-vercel

# API テスト
npm run test:api

# フロントエンドテスト
npm run test:run
```

### CI/CD での自動テスト

GitHub Actions が以下を自動実行:

1. ✅ 環境変数の検証
2. ✅ Vercel ビルドの成功確認  
3. ✅ API エンドポイントのテスト
4. ✅ TypeScript 型チェック
5. ✅ ESLint コード品質チェック

## 🚨 トラブルシューティング

### ビルドエラー「Environment validation failed」

**原因**: 必須環境変数が不足  
**解決**:
1. Vercel Dashboard で環境変数を確認
2. `MONGODB_MOCK=true` を設定してモックモードでビルド
3. ローカルで `npm run test:build-vercel` で検証

### API が 404 を返す

**原因**: Serverless Functions の設定問題  
**解決**:
1. `api/` フォルダ内の関数ファイルを確認
2. `vercel.json` の `functions` 設定を確認
3. デプロイ後の Functions ログを確認

### 管理画面をリロードすると 404

**原因**: SPA ルーティング未対応  
**解決**: `vercel.json` の `rewrites` 設定を確認

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### MongoDB 接続エラー

**原因**: 接続文字列や認証情報の問題  
**解決**:
1. MongoDB Atlas の IP ホワイトリスト確認 (Vercel IP: `0.0.0.0/0`)
2. データベース認証情報の確認
3. 本番では `MONGODB_MOCK=false` を設定

## 📊 監視とメンテナンス

### デプロイ後の確認項目

1. **フロントエンド確認**:
   ```bash
   curl -I https://your-app.vercel.app/
   curl -I https://your-app.vercel.app/admin
   ```

2. **API 確認**:
   ```bash
   curl https://your-app.vercel.app/api/rankings
   ```

3. **管理者機能確認**:
   - ログイン → 管理ダッシュボード
   - ユーザー管理機能
   - システム監視機能

### パフォーマンス監視

- Vercel Analytics でのページ表示速度確認
- Function ログでのエラー監視  
- システムヘルス API での監視

## 🔐 セキュリティ対策

### 本番環境でのベストプラクティス

1. **強力な認証情報**:
   - JWT_SECRET: 64文字以上のランダム文字列
   - ADMIN_DEFAULT_PASSWORD: 複雑なパスワード

2. **データベースセキュリティ**:
   - MongoDB Atlas のネットワークアクセス制御
   - SSL/TLS 接続の強制

3. **環境変数管理**:
   - Vercel Environment Variables のみ使用
   - `.env` ファイルはリポジトリにコミットしない

### 定期的なセキュリティチェック

```bash
# 依存関係の脆弱性チェック
npm audit

# 環境変数の設定確認
npm run test:env
```

## 🎯 次のステップ

### デプロイ完了後

1. **動作確認**: 全機能のテスト実行
2. **パフォーマンス最適化**: ページ読み込み速度の改善
3. **監視設定**: アラート設定とログ監視
4. **バックアップ**: データベースバックアップの確認

### 継続的改善

- CI/CD パイプラインの拡張
- 自動テストカバレッジの向上
- セキュリティ監査の定期実行
- パフォーマンス最適化

---

## 🆘 サポート

問題が発生した場合:

1. 📖 このガイドの再確認
2. 🧪 ローカルでのテスト実行  
3. 📋 GitHub Issues での報告
4. 📊 Vercel Functions ログの確認

**連絡先**: [GitHub Issues](https://github.com/your-repo/issues)