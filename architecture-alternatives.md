# 🔄 Vercel × MongoDB 代替アーキテクチャガイド

## 判断基準マトリックス

### 🚨 アーキテクチャ変更を検討すべきケース

| 症状 | 現在の状況 | 推奨対策 |
|------|------------|----------|
| 接続タイムアウト > 50% | M0/M2 + 複雑な集計 | → **Fluid Compute** |
| Cold start > 8秒 | Traditional connection | → **Data API** |
| クエリタイムアウト > 30% | 大量データ集計 | → **Atlas Search + Data API** |
| Error rate > 10% | 接続プール問題 | → **Serverless SQL (PlanetScale)** |
| レスポンス > 15秒 | 複雑な集計 | → **事前集計 + Redis** |

## Option 1: 🌊 Atlas Fluid Compute (Serverless)

### 💡 いつ選ぶべきか
- 現在M0〜M2を使用
- 不規則なトラフィック
- コールドスタート問題がある
- 予算を抑えたい

### ✅ 移行手順
```javascript
// 1. Atlas でServerless Instanceを作成
// ダッシュボード → Create Cluster → Serverless

// 2. 接続文字列の更新（自動的にFluid Compute対応になる）
const MONGODB_URI = 'mongodb+srv://username:password@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=YourApp';

// 3. 接続オプションの最適化
const serverlessOptions = {
  // Serverless特化設定
  maxPoolSize: 1,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  
  // タイムアウトは短めに
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 8000,
  
  // Serverlessに最適化
  heartbeatFrequencyMS: 60000,  // 1分
  retryWrites: true,
  readConcern: { level: 'local' }
};

// 4. クエリ最適化（Serverless向け）
const optimizedQuery = await Result
  .find(query)
  .lean()
  .maxTimeMS(15000)  // Serverlessでは少し長めに
  .limit(500)        // 結果セット制限
  .select('essential fields only');
```

### 📊 期待効果
- コールドスタート: 50%削減
- 接続安定性: 80%向上  
- コスト: 50-70%削減

## Option 2: 🔗 MongoDB Data API

### 💡 いつ選ぶべきか
- コネクション管理を完全に避けたい
- 単純なCRUD操作が中心
- HTTPベースの統一アクセス
- セキュリティを重視

### ✅ 移行手順

#### Step 1: Data API有効化
```bash
# Atlas Dashboard → Data API → Enable
# API Key作成
# URL Endpoint確認: https://data.mongodb-api.com/app/{app-id}/endpoint/data/v1
```

#### Step 2: 接続ライブラリ作成
```javascript
// api/_lib/data-api-client.js
class MongoDataAPI {
  constructor() {
    this.baseUrl = 'https://data.mongodb-api.com/app/your-app-id/endpoint/data/v1';
    this.apiKey = process.env.MONGODB_DATA_API_KEY;
    this.dataSource = 'Cluster0';
    this.database = 'morning_challenge';
  }

  async request(endpoint, body) {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify({
        dataSource: this.dataSource,
        database: this.database,
        ...body
      })
    });

    if (!response.ok) {
      throw new Error(`Data API error: ${response.statusText}`);
    }

    return response.json();
  }

  // 集計クエリ
  async aggregate(collection, pipeline) {
    return this.request('action/aggregate', {
      collection,
      pipeline
    });
  }

  // 検索
  async findMany(collection, filter = {}, options = {}) {
    return this.request('action/find', {
      collection,
      filter,
      ...options
    });
  }

  // カウント
  async count(collection, filter = {}) {
    const result = await this.request('action/aggregate', {
      collection,
      pipeline: [
        { $match: filter },
        { $count: 'total' }
      ]
    });
    return result.documents[0]?.total || 0;
  }
}

module.exports = new MongoDataAPI();
```

#### Step 3: API関数の書き換え
```javascript
// api/admin-stats-data-api.js
const dataAPI = require('./_lib/data-api-client');

async function getOverviewStatsDataAPI() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 並列実行（Data APIはHTTPなので安定）
    const [
      totalChallenges,
      challengesToday,
      weeklyStats
    ] = await Promise.all([
      dataAPI.count('results'),
      dataAPI.count('results', { date: today }),
      dataAPI.aggregate('results', [
        { $match: { createdAt: { $gte: weekAgo } } },
        {
          $group: {
            _id: '$date',
            totalChallenges: { $sum: 1 },
            averageCorrectRate: { 
              $avg: { $multiply: [{ $divide: ['$correctAnswers', '$totalProblems'] }, 100] }
            }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 7 }
      ])
    ]);

    return {
      totalChallenges,
      challengesToday,
      weeklyStats: weeklyStats.documents || []
    };
  } catch (error) {
    console.error('Data API error:', error);
    throw error;
  }
}

module.exports = async function handler(req, res) {
  // タイムアウトもHTTPレベルで制御
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const data = await getOverviewStatsDataAPI();
    clearTimeout(timeoutId);
    
    res.setHeader('Cache-Control', 's-maxage=300');
    res.json({ success: true, data });
  } catch (error) {
    clearTimeout(timeoutId);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      fallback: true
    });
  }
};
```

### 📊 Data API のメリット・デメリット

#### ✅ メリット
- 接続管理不要
- 安定したレスポンス
- 自動スケーリング
- セキュリティ強化

#### ❌ デメリット  
- HTTP オーバーヘッド
- 複雑なクエリの制限
- レスポンス形式の固定
- 追加コスト

## Option 3: 🚀 ハイブリッド構成（推奨）

### 💡 最強のアプローチ
```javascript
// api/_lib/hybrid-db-client.js
class HybridDatabaseClient {
  constructor() {
    this.preferDataAPI = process.env.PREFER_DATA_API === 'true';
    this.mongooseClient = require('./database-optimized');
    this.dataAPIClient = require('./data-api-client');
  }

  async executeQuery(operation) {
    const { type, collection, query, options = {} } = operation;
    
    // 軽量なクエリはData API
    if (this.shouldUseDataAPI(operation)) {
      return this.executeViaDataAPI(operation);
    }
    
    // 複雑なクエリはMongoose
    return this.executeViaMongoose(operation);
  }

  shouldUseDataAPI(operation) {
    const { type, complexity = 'simple' } = operation;
    
    return (
      this.preferDataAPI ||
      type === 'count' ||
      type === 'simple-find' ||
      complexity === 'simple'
    );
  }

  async executeViaDataAPI(operation) {
    console.log('📡 Using Data API for:', operation.type);
    // Data API実行
    return this.dataAPIClient.request(operation);
  }

  async executeViaMongoose(operation) {
    console.log('🔌 Using Mongoose for:', operation.type);
    // Mongoose実行
    await this.mongooseClient.connectMongoose();
    return this.executeMongooseQuery(operation);
  }
}
```

## Option 4: 📊 事前集計アーキテクチャ

### 💡 重い集計をリアルタイムから分離
```javascript
// background/daily-aggregation.js (Vercel Cron Jobs)
module.exports = async function handler(req, res) {
  // 毎日深夜に実行される事前集計
  const today = new Date().toISOString().split('T')[0];
  
  const dailyStats = await Result.aggregate([
    { $match: { date: today } },
    {
      $group: {
        _id: null,
        totalChallenges: { $sum: 1 },
        averageCorrectRate: { $avg: { $multiply: [{ $divide: ['$correctAnswers', '$totalProblems'] }, 100] } },
        difficultyBreakdown: {
          $push: {
            difficulty: '$difficulty',
            correctRate: { $multiply: [{ $divide: ['$correctAnswers', '$totalProblems'] }, 100] }
          }
        }
      }
    }
  ]);

  // 事前集計結果をキャッシュテーブルに保存
  await DailyStatsCache.findOneAndUpdate(
    { date: today },
    { stats: dailyStats[0] },
    { upsert: true }
  );

  res.json({ success: true, processed: today });
};

// vercel.json でcron設定
{
  "crons": [{
    "path": "/api/background/daily-aggregation",
    "schedule": "0 2 * * *"  // 毎日午前2時
  }]
}
```

## 🎯 移行成功指標

### Phase 1: 基本安定化 (1-2週間)
- [ ] Timeout rate < 5%
- [ ] Connection success rate > 95%
- [ ] Average response time < 8秒

### Phase 2: パフォーマンス最適化 (2-4週間)  
- [ ] Average response time < 5秒
- [ ] Cold start frequency < 30%
- [ ] Error rate < 2%

### Phase 3: 本格運用 (1-2ヶ月)
- [ ] 99.9% uptime
- [ ] Sub-3秒 response time
- [ ] Zero timeout errors

## 💰 コスト比較

| アーキテクチャ | 月額コスト(予測) | 安定性 | 開発効率 |
|----------------|------------------|--------|----------|
| M0 + Mongoose | $0 | ⭐⭐ | ⭐⭐⭐ |
| M2 + Mongoose | $9 | ⭐⭐⭐ | ⭐⭐⭐ |
| Serverless + Mongoose | $5-15 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Data API | $10-25 | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Hybrid | $8-20 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |