# トラブルシューティングガイド

## 管理者権限が表示されない問題の解決過程

### 📅 発生日時
2025年6月23日

### 🐛 問題の症状
- `admin@example.com` でログインしても管理者メニューが表示されない
- 以前のモック環境では正常に動作していた
- ログイン自体は成功するが `isAdmin: false` で返ってくる

### 🔍 調査・デバッグ過程

#### 1. 初期仮説と検証
**仮説**: フロントエンドのAuthContext処理に問題がある
- **検証方法**: コンソールログでAuthContextの動作確認
- **結果**: AuthContextのログが全く表示されない → AuthProviderが正しく動作していない可能性

#### 2. AuthContext詳細調査
**実施内容**:
```javascript
// AuthContext.tsx に詳細ログ追加
console.log('🔥🔥🔥 [AuthContext] PROVIDER FUNCTION CALLED!');
console.log('🔥🔥🔥 [AuthContext] LOGIN FUNCTION CALLED!');
```
- **結果**: AuthContextは正常に動作していたが、APIから `isAdmin: false` で返ってくることが判明

#### 3. バックエンドAPI調査
**実施内容**:
```javascript
// authController.js に詳細ログ追加
logger.debug(`🔥🔥🔥 [AuthController] Found user: ${user.username}, isAdmin: ${user.isAdmin}`);
```
- **結果**: サーバー側でも `isAdmin: false` が返されている

#### 4. データベース層調査
**実施内容**:
```javascript
// User.js のselect処理にログ追加
logger.debug(`🔥🔥🔥 [UserModel] isAdmin: ${userWithMethod.isAdmin}`);

// database.js のfindMockUser関数にログ追加
logger.debug(`🔥🔥🔥 [findMockUser] isAdmin: ${user.isAdmin}`);
```

#### 5. 環境変数の確認（根本原因発見）
**実施内容**:
```bash
vercel env ls
```
**結果**: `MONGODB_MOCK` 環境変数がVercelに設定されていない！

### 🎯 根本原因
**Vercel環境で `MONGODB_MOCK=true` が設定されていないため、モックデータではなく実際のMongoDBに接続しようとしていた**

- ローカル開発環境: `.env` ファイルで `MONGODB_MOCK=true` 設定済み
- Vercel本番環境: 環境変数未設定 → MongoDB接続失敗 → isAdminフラグが正しく取得できない

### ✅ 解決方法

#### 1. Vercel環境変数の設定
```bash
# 全環境にMONGODB_MOCK=trueを設定
echo "true" | vercel env add MONGODB_MOCK production
echo "true" | vercel env add MONGODB_MOCK preview
echo "true" | vercel env add MONGODB_MOCK development
```

#### 2. 再デプロイ
```bash
vercel --prod
```

#### 3. 確認
```bash
vercel env ls
# MONGODB_MOCK が全環境に設定されていることを確認
```

### 📝 学んだ教訓

#### 1. **環境変数の一貫性**
- ローカル開発環境とデプロイ環境で環境変数が一致していない問題
- **対策**: 環境変数チェックリストの作成、デプロイ前の環境変数確認

#### 2. **デバッグログの重要性**
- フロントエンド → バックエンド → データベース層の順序でログを追加することで問題箇所を特定
- **対策**: 各層に詳細なデバッグログを事前に仕込んでおく

#### 3. **問題の分離と段階的解決**
- 「管理者権限が表示されない」という現象から、段階的に原因を絞り込み
- 最終的に環境設定の問題であることを特定

#### 4. **モック環境の依存関係**
- モック環境での開発時は、本番環境でも同じ設定が必要
- **対策**: 環境変数の自動チェック機能の実装

### 🛠️ 予防策

#### 1. 環境変数チェックスクリプト
```javascript
// 必要な環境変数をチェック
const requiredEnvVars = ['MONGODB_MOCK', 'JWT_SECRET', 'MONGODB_URI'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`);
  }
});
```

#### 2. デプロイ前チェックリスト
- [ ] 必要な環境変数がすべて設定されているか
- [ ] ローカル環境とデプロイ環境で動作が一致するか
- [ ] モック環境での管理者権限テスト

#### 3. ヘルスチェック機能
```javascript
// /api/health エンドポイントで環境設定を確認
app.get('/api/health', (req, res) => {
  res.json({
    mongodb_mock: process.env.MONGODB_MOCK,
    environment: process.env.NODE_ENV,
    // その他重要な設定
  });
});
```

### 🔄 類似問題への対応フロー

1. **症状の特定**: 何が期待通りに動作していないか
2. **フロントエンド確認**: ブラウザコンソールでUI層のログ確認
3. **API層確認**: サーバーログでAPI応答の確認
4. **データ層確認**: データベース・モックデータの状態確認
5. **環境設定確認**: 環境変数、設定ファイルの確認
6. **段階的修正**: 特定した問題から順次修正

### 📚 参考コマンド

```bash
# Vercel環境変数管理
vercel env ls                    # 環境変数一覧
vercel env add NAME value env    # 環境変数追加
vercel env rm NAME env           # 環境変数削除

# デバッグ用ログ確認
vercel logs                      # 本番ログ確認
vercel dev                       # ローカル開発サーバー

# Git管理
git log --oneline -10            # 最近のコミット履歴
git diff HEAD~1                  # 前回からの変更確認
```

### 🎯 今後の改善点

1. **自動化**: 環境変数チェックをCI/CDパイプラインに組み込み
2. **監視**: 本番環境での管理者権限関連のエラー監視
3. **ドキュメント**: 環境設定手順書の整備
4. **テスト**: 環境依存の機能の自動テスト追加

---
*このドキュメントは今後の開発で類似問題が発生した際の参考資料として活用してください。* 