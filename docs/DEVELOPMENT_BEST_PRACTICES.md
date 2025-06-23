# 開発ベストプラクティス集

## 🎯 概要
朝の計算チャレンジアプリ開発で得られた知見をもとに、今後の開発に活かせるベストプラクティスをまとめました。

## 🔧 環境設定・デプロイ

### 環境変数管理
- **一貫性の確保**: ローカル、ステージング、本番環境で同じ環境変数を設定
- **必須変数のチェック**: アプリ起動時に必要な環境変数の存在確認
- **機密情報の管理**: `.env.example` でテンプレート提供、実際の値は暗号化

```javascript
// 環境変数チェック例
const requiredEnvVars = ['MONGODB_MOCK', 'JWT_SECRET', 'MONGODB_URI'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error('❌ Missing environment variables:', missingVars);
  process.exit(1);
}
```

### デプロイ前チェックリスト
- [ ] 環境変数がすべての環境で設定済み
- [ ] ローカルとリモートで動作が一致
- [ ] 認証・権限系機能のテスト実行
- [ ] ヘルスチェックエンドポイントの確認

## 🐛 デバッグ・トラブルシューティング

### 段階的デバッグ手法
1. **症状の特定**: 何が期待通りに動作していないか明確化
2. **フロントエンド確認**: ブラウザコンソールでUI層の状態確認
3. **API層確認**: サーバーログでAPI応答の確認
4. **データ層確認**: データベース・モックデータの状態確認
5. **環境設定確認**: 環境変数、設定ファイルの確認

### 効果的なログ出力
```javascript
// 層別ログの例
console.log('🔥🔥🔥 [Layer] Function: 具体的な処理内容');
logger.debug(`🔥🔥🔥 [Controller] User: ${user.username}, isAdmin: ${user.isAdmin}`);
```

**ルール**:
- 絵文字で目立たせる（`🔥🔥🔥`）
- `[Layer]` で処理層を明示
- 重要な変数値を必ず出力
- 開発時は詳細ログ、本番は最小限に

### モック環境の管理
- **明確な分離**: 本番とモック環境で異なる動作を明示
- **環境フラグ**: `MONGODB_MOCK=true` などで制御
- **データ一貫性**: モックデータと本番データの構造を統一

## 🏗️ アーキテクチャ・設計

### 認証・権限管理
```javascript
// 権限チェックの統一パターン
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
};
```

### エラーハンドリング
```javascript
// 統一エラーレスポンス形式
const sendErrorResponse = (res, statusCode, message, details = null) => {
  res.status(statusCode).json({
    error: message,
    details,
    timestamp: new Date().toISOString()
  });
};
```

### API設計原則
- **一貫性**: 全エンドポイントで同じレスポンス形式
- **冪等性**: 同じリクエストは同じ結果を返す
- **適切なHTTPステータスコード**: 200/201/400/401/403/404/500の使い分け

## 🧪 テスト戦略

### 環境依存機能のテスト
```javascript
// モック環境でのテスト例
describe('Admin Authentication', () => {
  beforeEach(() => {
    process.env.MONGODB_MOCK = 'true';
  });
  
  test('should authenticate admin user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin@example.com', password: 'admin123' });
    
    expect(response.body.user.isAdmin).toBe(true);
  });
});
```

### テスト環境の分離
- **ユニットテスト**: 個別関数の動作確認
- **統合テスト**: API層とデータ層の連携確認
- **E2Eテスト**: フロントエンド〜バックエンド全体の動作確認

## 📊 監視・運用

### ヘルスチェック機能
```javascript
// 包括的なヘルスチェック
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      node_env: process.env.NODE_ENV,
      mongodb_mock: process.env.MONGODB_MOCK,
      has_jwt_secret: !!process.env.JWT_SECRET
    },
    database: {
      connected: mongoose.connection.readyState === 1,
      status: mongoose.connection.readyState
    },
    version: process.env.npm_package_version || 'unknown'
  };
  
  res.json(health);
});
```

### ログ監視
- **重要イベント**: ログイン失敗、権限エラー、システムエラー
- **パフォーマンス**: レスポンス時間、DB接続時間
- **ビジネスメトリクス**: アクティブユーザー数、問題解答率

## 🔄 CI/CD・自動化

### 自動チェック項目
```yaml
# GitHub Actions例
name: Deploy Check
on:
  push:
    branches: [main]
    
jobs:
  deploy-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Environment Variables Check
        run: |
          node scripts/check-env.js
      - name: Run Tests
        run: |
          npm test
      - name: Admin Function Test
        run: |
          npm run test:admin
```

### デプロイ自動化
- **環境変数検証**: 必要な設定がすべて存在するか
- **テスト実行**: 全テストがパスするか
- **ヘルスチェック**: デプロイ後にサービスが正常動作するか

## 📝 ドキュメント管理

### 必須ドキュメント
1. **README.md**: プロジェクト概要、セットアップ手順
2. **API仕様書**: エンドポイント一覧、リクエスト/レスポンス形式
3. **環境設定ガイド**: 必要な環境変数、設定手順
4. **トラブルシューティングガイド**: よくある問題と解決方法
5. **デプロイガイド**: 本番環境への展開手順

### コードコメント原則
```javascript
// ❌ 悪い例
const result = user.isAdmin; // isAdminを取得

// ✅ 良い例  
const result = user.isAdmin; // モック環境では固定値、本番では DB の is_admin フィールドから取得
```

## 🚀 パフォーマンス最適化

### フロントエンド
- **コンポーネント分割**: 適切な粒度で再利用可能に
- **状態管理**: 必要最小限のstate更新
- **メモ化**: React.memo, useMemo, useCallbackの活用

### バックエンド
- **データベースインデックス**: 検索クエリの最適化
- **キャッシュ戦略**: Redis等での頻繁なクエリ結果キャッシュ
- **API設計**: 必要なデータのみ取得・送信

## 🔒 セキュリティ

### 認証・認可
- **JWT管理**: 適切な有効期限設定、リフレッシュトークン
- **パスワード**: ハッシュ化、強度チェック
- **セッション**: HTTPS必須、secure cookie

### データ保護
- **入力検証**: SQL injection、XSS対策
- **権限チェック**: API毎の適切な権限確認
- **ログ出力**: 機密情報の除外

## 🔍 コードレビュー

### レビューポイント
1. **機能要件**: 仕様通りに動作するか
2. **セキュリティ**: 脆弱性は無いか
3. **パフォーマンス**: 不要な処理は無いか
4. **保守性**: 理解しやすいコードか
5. **テスト**: 適切なテストが書かれているか

### チェックリスト
- [ ] 環境変数の追加・変更がある場合は全環境で設定
- [ ] 新しいAPIエンドポイントには適切な権限チェック
- [ ] エラーハンドリングが適切に実装されている
- [ ] ログ出力で機密情報が漏洩していない
- [ ] 破壊的変更の場合は移行手順を文書化

## 🎯 まとめ

これらのベストプラクティスは今回の管理者権限問題の解決過程で得られた教訓をもとに作成されました。特に：

1. **環境変数の一貫性**: 最も重要な要素の一つ
2. **段階的デバッグ**: 問題箇所の効率的な特定方法
3. **自動化**: 人的ミスを防ぐための仕組み作り
4. **監視**: 問題の早期発見と対応

これらを日常の開発プロセスに組み込むことで、今回のような問題を未然に防ぎ、より安定したシステムを構築できます。

---
*定期的にこのドキュメントを見直し、新しい知見を追加してください。* 