# 🔍 Vercel × MongoDB Atlas トラブル完全デバッグガイド

## Phase 1: 基本設定確認

### ✅ 環境変数チェック
```bash
# Vercel CLIでの確認
vercel env ls

# 必須チェック項目
- MONGODB_URI: 正しい形式か？
- 特殊文字やスペースが含まれていないか？
- パスワードのURLエンコードは正しいか？
- データベース名は正しいか？
```

### ✅ MongoDB Atlas設定確認
```javascript
// Atlas ダッシュボードで確認
1. Network Access: 0.0.0.0/0 が設定されているか？
2. Database Access: 適切なロールが設定されているか？
3. Cluster Status: 正常に稼働中か？
4. リージョン: us-east-1 (Vercelと同じ) が推奨

// Atlas Logs で確認
- Connection attempts
- Authentication failures
- Timeout errors
```

### ✅ Vercel Function設定確認
```json
// vercel.json
{
  "functions": {
    "api/**/*.js": {
      "regions": ["iad1"],  // us-east-1
      "maxDuration": 30
    }
  }
}
```

## Phase 2: リアルタイム診断

### 🚨 接続診断用API作成
```javascript
// api/debug-connection.js
const { connectMongoose, getConnectionStats } = require('./_lib/database-optimized');

module.exports = async function handler(req, res) {
  const diagnosis = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      vercel: !!process.env.VERCEL,
      region: process.env.VERCEL_REGION || 'unknown'
    },
    uri: {
      hasUri: !!process.env.MONGODB_URI,
      format: process.env.MONGODB_URI?.startsWith('mongodb+srv://') ? 'srv' : 'standard',
      length: process.env.MONGODB_URI?.length || 0
    }
  };

  try {
    // Step 1: 接続テスト
    const startTime = Date.now();
    await connectMongoose();
    const connectionTime = Date.now() - startTime;

    // Step 2: 基本クエリテスト
    const pingStart = Date.now();
    const mongoose = require('mongoose');
    await mongoose.connection.db.admin().ping();
    const pingTime = Date.now() - pingStart;

    diagnosis.connection = {
      success: true,
      connectionTime,
      pingTime,
      stats: getConnectionStats()
    };

    res.status(200).json(diagnosis);
  } catch (error) {
    diagnosis.connection = {
      success: false,
      error: error.message,
      stack: error.stack
    };
    
    res.status(500).json(diagnosis);
  }
};
```

### 📊 クエリパフォーマンス診断
```javascript
// api/debug-queries.js
module.exports = async function handler(req, res) {
  try {
    await connectMongoose();
    const Result = mongoose.model('Result');
    
    const tests = [];
    
    // Test 1: Simple count
    const t1 = Date.now();
    const count = await Result.countDocuments().maxTimeMS(5000);
    tests.push({ test: 'count', time: Date.now() - t1, result: count });
    
    // Test 2: Simple find
    const t2 = Date.now();
    const docs = await Result.find().limit(1).lean().maxTimeMS(5000);
    tests.push({ test: 'find-one', time: Date.now() - t2, result: docs.length });
    
    // Test 3: Aggregation
    const t3 = Date.now();
    const agg = await Result.aggregate([
      { $limit: 100 },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]).maxTimeMS(10000);
    tests.push({ test: 'aggregation', time: Date.now() - t3, result: agg[0]?.count || 0 });
    
    res.json({ success: true, tests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

## Phase 3: 段階的問題特定

### 🔍 タイムアウト原因特定
```bash
# 1. Vercel Function Logs確認
vercel logs --follow

# 2. 特定パターンをチェック
- "Operation `xxx` buffering timed out" → bufferCommands: false設定必須
- "Server selection timed out" → Atlas接続問題
- "Socket timeout" → socketTimeoutMS設定問題
- "MongooseError: Operation xxx was not wrapped in a session" → トランザクション問題
```

### 📈 データ0件問題の診断
```javascript
// データ存在確認用コード
const mongoose = require('mongoose');

// Raw MongoDB クライアントで直接確認
const db = mongoose.connection.db;
const collections = await db.listCollections().toArray();
console.log('Available collections:', collections.map(c => c.name));

const collection = db.collection('results');
const docCount = await collection.countDocuments();
console.log('Document count in results:', docCount);

const sampleDocs = await collection.find().limit(3).toArray();
console.log('Sample documents:', sampleDocs);
```

## Phase 4: 高度なトラブルシューティング

### 🚨 接続プール問題の特定
```javascript
// 接続プール状態監視
setInterval(() => {
  const stats = getConnectionStats();
  console.log('Connection Pool Stats:', {
    readyState: stats.readyState,
    isHealthy: stats.isHealthy,
    errorCount: stats.errorCount,
    uptime: stats.uptime
  });
}, 10000);
```

### 🔧 Atlas Performance Advisor活用
```bash
# Atlas ダッシュボード → Performance Advisor
1. Slow queries の確認
2. Index suggestions の確認
3. Schema anti-patterns の確認
```

### 📊 Vercel Analytics活用
```bash
# Vercel ダッシュボード → Functions
1. Function duration の確認
2. Cold start frequency の確認
3. Error rate の確認
```

## Phase 5: 緊急対応手順

### 🚨 即座にできる応急処置
```javascript
// 1. 接続タイムアウトを短縮
serverSelectionTimeoutMS: 5000  // 10秒→5秒

// 2. クエリタイムアウトを厳格化
.maxTimeMS(8000)  // 25秒→8秒

// 3. 結果セット制限を厳しく
.limit(100)  // 1000→100

// 4. 不要なpopulateを削除
.lean()  // 必ず追加

// 5. キャッシュヘッダーを積極活用
res.setHeader('Cache-Control', 's-maxage=300');
```

### 🔄 段階的ロールバック
```javascript
// Stage 1: 最小構成に戻す
- 集計クエリを全てcountDocuments()に置換
- populateを全て削除
- ソートを削除

// Stage 2: 機能を一つずつ復旧
- 基本的なfindクエリから開始
- 単純な集計から追加
- 最後にソート・populate追加
```

## 🎯 Critical Success Metrics

### 正常稼働の指標
- Connection time: < 3秒
- Query time: < 5秒
- Total response time: < 10秒
- Error rate: < 1%
- Success rate: > 99%

### 危険信号
- Connection time: > 8秒
- Query timeout frequency: > 5%
- Error rate: > 5%
- Cold start frequency: > 50%