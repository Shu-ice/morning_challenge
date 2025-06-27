# 📋 Results Schema Migration Guide

## 概要
`results`コレクションのスキーマ不整合を解消するための一度きり実行スクリプトです。

## 問題の説明
現在のresultsコレクションには以下の不整合があります：
- **userIdの型不整合**: 文字列(String)とObjectIdが混在
- **欠損フィールド**: `incorrectAnswers`、`unanswered`、`timestamp`が一部のドキュメントで欠損

## 修正内容

### 1. userIdの型統一
```javascript
// 修正前（文字列）
{ userId: "507f1f77bcf86cd799439011" }

// 修正後（ObjectId）
{ userId: ObjectId("507f1f77bcf86cd799439011") }
```

### 2. 欠損フィールドの補完
```javascript
// incorrectAnswers の計算
incorrectAnswers = totalProblems - correctAnswers - unanswered

// timestamp の設定
timestamp = createdAt || new Date()

// unanswered の設定（存在しない場合）
unanswered = 0
```

## 🚀 実行方法

### ⚠️ 事前準備（重要）
```bash
# 1. データベースのバックアップを必ず作成
mongodump --uri="your_mongodb_uri" --db=morning_challenge

# 2. 環境変数が設定されていることを確認
echo $MONGODB_URI
```

### 基本実行
```bash
# プロジェクトルートディレクトリで実行
cd /path/to/morning_challenge
node scripts/migrate_results_schema.js
```

### 確認スキップ実行（自動化用）
```bash
# 確認プロンプトをスキップして実行
SKIP_CONFIRMATION=true node scripts/migrate_results_schema.js
```

### 本番環境での実行
```bash
# 本番環境では特に慎重に
NODE_ENV=production node scripts/migrate_results_schema.js
```

## 📊 実行結果例

```
[INFO] 2024-01-15T10:30:00.000Z - 🚀 Starting Results Collection Schema Migration
[INFO] 2024-01-15T10:30:01.000Z - 📡 Connecting to MongoDB: mongodb+srv://***:***@cluster.mongodb.net
[SUCCESS] 2024-01-15T10:30:02.000Z - ✅ Connected to MongoDB successfully
[INFO] 2024-01-15T10:30:03.000Z - 📊 Total documents in results collection: 1250
[INFO] 2024-01-15T10:30:04.000Z - 🔄 Starting document processing with cursor...
[INFO] 2024-01-15T10:30:05.000Z - Document 507f1f77bcf86cd799439011: Converting userId from string to ObjectId
[INFO] 2024-01-15T10:30:05.000Z - Document 507f1f77bcf86cd799439011: Adding incorrectAnswers field (value: 3)
[SUCCESS] 2024-01-15T10:30:05.000Z - ✅ Document 507f1f77bcf86cd799439011: Successfully updated
[INFO] 2024-01-15T10:30:06.000Z - 📈 Progress: 100/1250 documents processed
...
[SUCCESS] 2024-01-15T10:30:20.000Z - ✅ 🎉 Migration completed successfully!

================================================================================
📋 MIGRATION REPORT
================================================================================
📊 Total Documents: 1250
✅ Processed Documents: 892
➡️  Unchanged Documents: 358
🔄 UserID Conversions: 445
➕ IncorrectAnswers Added: 447
⏰ Timestamp Added: 892
❌ Errors: 0

🎯 Migration Success Rate: 100.00%
================================================================================
```

## 🔍 トラブルシューティング

### よくあるエラーと対処法

#### 1. 接続エラー
```
Error: Failed to connect to MongoDB
```
**対処法:**
- MONGODB_URIが正しく設定されているか確認
- ネットワーク接続を確認
- MongoDB Atlasの場合、IPアドレス許可設定を確認

#### 2. 権限エラー
```
Error: not authorized on morning_challenge
```
**対処法:**
- データベースユーザーに読み書き権限があることを確認
- 接続文字列のユーザー名・パスワードを確認

#### 3. ObjectId変換エラー
```
Document xxx: Invalid ObjectId string format
```
**対処法:**
- これは警告で、無効なObjectId文字列は変換されずにスキップされます
- 必要に応じて手動で該当ドキュメントを確認

## 🔧 カスタマイズ

### バッチサイズの調整
```javascript
// メモリ使用量が多い場合は小さく
const cursor = collection.find({}).batchSize(50);

// 高速処理したい場合は大きく
const cursor = collection.find({}).batchSize(200);
```

### 特定条件のドキュメントのみ処理
```javascript
// 例：特定日付以降のドキュメントのみ
const cursor = collection.find({
  createdAt: { $gte: new Date('2024-01-01') }
}).batchSize(100);
```

## ⚡ パフォーマンス最適化

### 大量データ処理時のチューニング
```bash
# MongoDB接続パラメータの調整
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/db?maxPoolSize=1&serverSelectionTimeoutMS=10000"
```

### プロセス監視
```bash
# メモリ使用量監視
watch -n 1 'ps aux | grep node'

# MongoDB側の監視（Atlas Performance Advisorを使用）
```

## 🚨 注意事項

1. **バックアップ必須**: 実行前に必ずデータベースのバックアップを作成
2. **本番環境**: 必ずステージング環境で事前テスト
3. **ダウンタイム**: 大量データの場合は処理時間を考慮
4. **冪等性**: 同じスクリプトを複数回実行しても安全
5. **ロールバック**: 問題発生時はバックアップから復元

## ✅ 実行後の確認

### データ整合性確認クエリ
```javascript
// MongoDB Shellで実行
use morning_challenge;

// 1. userId型の確認
db.results.aggregate([
  { $group: { _id: { $type: "$userId" }, count: { $sum: 1 } } }
]);

// 2. 欠損フィールドの確認
db.results.countDocuments({ incorrectAnswers: { $exists: false } });
db.results.countDocuments({ timestamp: { $exists: false } });

// 3. 計算値の検証（サンプル）
db.results.find({}).limit(5).forEach(doc => {
  const calculated = doc.totalProblems - doc.correctAnswers - doc.unanswered;
  print(`Doc ${doc._id}: calculated=${calculated}, actual=${doc.incorrectAnswers}`);
});
```

## 📞 サポート

問題が発生した場合：
1. エラーログを確認
2. Migration Reportを確認
3. 必要に応じてバックアップから復元
4. スクリプトの再実行（冪等性により安全）