# Changelog

## [未リリース] - 2025-06-26

### 🗑️ 削除 (Removed)
- **モック API**: ダミー値を返す `api/admin-dashboard.js` を削除
- **フォールバックロジック**: AdminDashboardコンポーネントのモックAPIフォールバックを削除

### 🔄 変更 (Changed)
- **管理者ダッシュボード**: 個別API (`/admin/stats/*`, `/monitoring/*`) のみ使用するように変更
- **Vercel関数数**: 12から11に減少、デプロイメント制限を満たす

### ✨ 新機能 (Added)
- **日次チャレンジ制限**: 1日に1回までのチャレンジ制限を実装
  - 2回目以降の `GET /api/problems` で 409 ステータスを返却
  - 直接の `POST /api/problems/submit` でも 409 エラーで拒否
  - 管理者 (`isAdmin=true`) は制限をバイパス可能
  - テスト環境 (`DISABLE_TIME_CHECK=true`) では従来通り複数回可能
- **ユーザーエクスペリエンス**: 409エラー検知時に「本日は挑戦済み」メッセージを表示しホームへ誘導

### ✨ 改善 (Improved)
- **データ品質**: モック値ではなく実際のバックエンドデータを表示
- **保守性**: 使用されないコードを削除しコードベースをシンプル化
- **テストカバレッジ**: 日次チャレンジ制限の包括的なテストを追加

## [前回リリース] - 2025-06-19

### 🔧 修正 (Fixed)
- **ランキングAPI**: `TypeError: Cannot read properties of undefined (reading 'toString')` エラーを修正
- **モック環境**: ユーザー情報の_id保証を強化し、undefined値による500エラーを防止
- **populate失敗時**: 安全なフォールバック処理を実装

### ✨ 追加 (Added)
- **テスト**: ランキングAPIの包括的な単体テスト追加 (`server/tests/ranking.test.js`)
- **型定義**: フロントエンド型定義を更新し、ランキングエントリにgrade/avatarフィールド追加
- **ログ機能**: console.logをlogger.debugに置き換えて一貫性を向上

### 🏗️ 変更 (Changed)
- **ランキングコントローラー**: undefined safety対応の全面リファクタリング
- **モックデータ**: 新規ユーザー追加時の_id重複チェック機能追加
- **エラーハンドリング**: より詳細で安全なエラー処理を実装

### 📝 技術的詳細

#### server/controllers/rankingController.js
- `allUserIds`生成時のnull/undefined安全性を確保
- populate失敗時の代替ユーザー情報取得ロジック改善
- デフォルト値を持たないgradeフィールドに`?? 0`を追加

#### server/config/database.js
- `addMockUser()`で_id重複チェックと必須フィールドデフォルト値設定
- `getMockUsers()`で無効ユーザーの除外機能追加

#### server/tests/ranking.test.js
- populate成功/失敗ケースのテスト追加
- モック環境での500エラー防止テスト
- 回帰テスト (TypeError防止)

#### src/types/api.ts
- `RankingEntry`にgrade, avatar, streak等のフィールド追加
- `RankingApiResponse`の構造をサーバーレスポンスに合わせて修正

### 🎯 DoD完了項目
- ✅ 500エラーが発生せず、正常時`status 200 + JSON { success:true, data:[...] }`を返す
- ✅ populate成功/失敗どちらでも`userId`, `username`, `grade`, `avatar`が必ず埋まる
- ✅ モック環境(`MONGODB_MOCK=true`)と実DB環境の両方で動作
- ✅ TypeScript型定義を維持
- ✅ コード整形とログの一貫性向上

### 🧪 検証方法
```bash
# モック環境テスト
MONGODB_MOCK=true npm run dev
curl "http://localhost:5003/api/rankings/daily?difficulty=beginner&date=2025-06-19"

# 実DB環境テスト  
MONGODB_MOCK=false npm run dev
curl "http://localhost:5003/api/rankings/daily?difficulty=beginner"

# 単体テスト実行
cd server && npm test
```