// 🚀 最適化されたVercel API関数の実装例
// タイムアウト・エラー処理・パフォーマンス最適化を完全実装

const mongoose = require('mongoose');
const { 
  connectMongoose, 
  optimizeQuery, 
  optimizeAggregation, 
  getConnectionStats,
  withTimeout 
} = require('./_lib/database-optimized');

// ========================================
// 1. スキーマ定義（最適化版）
// ========================================
const resultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String, required: true, index: true },
  grade: { type: Number, required: false, default: 0 },
  difficulty: { type: String, required: true, enum: ['beginner', 'intermediate', 'advanced', 'expert'], index: true },
  date: { type: String, required: true, index: true },
  totalProblems: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  timeSpent: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  // パフォーマンス最適化
  collection: 'results',
  versionKey: false,
  strict: true
});

// 複合インデックス（重要：事前にAtlasで作成推奨）
resultSchema.index({ date: 1, difficulty: 1, score: -1 });
resultSchema.index({ userId: 1, createdAt: -1 });
resultSchema.index({ createdAt: 1, difficulty: 1 });

// モデル定義（キャッシュ対応）
let Result;
try {
  Result = mongoose.model('Result');
} catch {
  Result = mongoose.model('Result', resultSchema);
}

// ========================================
// 2. エラーレスポンス統一ヘルパー
// ========================================
function createErrorResponse(error, operation = 'operation') {
  const isTimeout = error.message.includes('timed out') || error.message.includes('timeout');
  const isConnection = error.message.includes('connection') || error.message.includes('connect');
  
  return {
    success: false,
    error: 'Internal server error',
    message: `${operation}中にエラーが発生しました`,
    details: {
      type: isTimeout ? 'timeout' : isConnection ? 'connection' : 'unknown',
      message: error.message,
      timestamp: new Date().toISOString()
    },
    stats: getConnectionStats()
  };
}

// ========================================
// 3. 集計クエリ実装例（完全最適化版）
// ========================================
async function getOptimizedOverviewStats() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  try {
    // 🔥 戦略1: 基本統計を並列実行（軽量クエリ）
    const basicStats = await withTimeout(
      Promise.all([
        // カウントクエリは高速
        Result.countDocuments().maxTimeMS(5000),
        Result.countDocuments({ date: today }).maxTimeMS(5000),
        Result.distinct('userId', { date: today }).maxTimeMS(5000)
      ]),
      12000, // 12秒でタイムアウト
      'basic-stats-parallel'
    );

    const [totalChallenges, challengesToday, activeUsersToday] = basicStats;

    // 🔥 戦略2: 重い集計は別途実行 + フォールバック
    let weeklyStats = [];
    try {
      weeklyStats = await withTimeout(
        optimizeAggregation(Result, [
          { $match: { createdAt: { $gte: weekAgo } } },
          {
            $group: {
              _id: '$date',
              totalChallenges: { $sum: 1 },
              averageCorrectRate: { 
                $avg: { 
                  $cond: [
                    { $eq: ['$totalProblems', 0] },
                    0,
                    { $multiply: [{ $divide: ['$correctAnswers', '$totalProblems'] }, 100] }
                  ]
                } 
              },
              uniqueUsers: { $addToSet: '$userId' }
            }
          },
          { $addFields: { uniqueUsers: { $size: '$uniqueUsers' } } },
          { $sort: { _id: 1 } },
          { $limit: 7 } // 結果セット制限
        ], { maxTimeMS: 15000 }), // 集計用に15秒
        18000,
        'weekly-stats-aggregation'
      );
    } catch (aggError) {
      console.warn('Weekly stats aggregation failed, using fallback:', aggError.message);
      // フォールバック：簡単な統計のみ
      weeklyStats = [{
        _id: today,
        totalChallenges: challengesToday,
        averageCorrectRate: 0,
        uniqueUsers: activeUsersToday.length
      }];
    }

    // 🔥 戦略3: 最近のアクティビティ（限定的なデータ取得）
    let recentActivity = [];
    try {
      const recentResults = await withTimeout(
        optimizeQuery(
          Result.find({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
            .select('username grade difficulty correctAnswers totalProblems timeSpent date createdAt')
            .sort({ createdAt: -1 })
            .limit(20), // 最大20件
          { maxTimeMS: 8000, lean: true }
        ),
        10000,
        'recent-activity'
      );

      recentActivity = recentResults.map(activity => ({
        id: activity._id.toString(),
        username: activity.username,
        grade: activity.grade,
        difficulty: activity.difficulty,
        correctAnswers: activity.correctAnswers,
        totalProblems: activity.totalProblems,
        timeSpent: activity.timeSpent,
        date: activity.date,
        createdAt: activity.createdAt.toISOString()
      }));
    } catch (activityError) {
      console.warn('Recent activity query failed:', activityError.message);
      // 空配列でフォールバック
    }

    return {
      totalUsers: 0, // User modelがない場合のダミー
      activeUsersToday: activeUsersToday.length,
      totalChallenges,
      challengesToday,
      problemSetsCount: 0, // ProblemSet modelがない場合のダミー
      weeklyStats: weeklyStats.map(stat => ({
        date: stat._id,
        totalChallenges: stat.totalChallenges,
        averageCorrectRate: Math.round(stat.averageCorrectRate || 0),
        uniqueUsers: stat.uniqueUsers
      })),
      recentActivity,
      // デバッグ情報
      _debug: {
        connectionStats: getConnectionStats(),
        queryTime: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Overview stats error:', error);
    throw error;
  }
}

// ========================================
// 4. API ハンドラー（完全実装版）
// ========================================
module.exports = async function handler(req, res) {
  const startTime = Date.now();
  
  // 🚨 重要：レスポンスタイムアウト設定
  res.setTimeout(28000); // Vercel 30秒制限の少し前

  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    // 🔥 ステップ1: データベース接続（タイムアウト付き）
    console.log('🔌 Connecting to database...');
    await withTimeout(
      connectMongoose(),
      12000, // 接続に12秒まで
      'database-connection'
    );
    
    const connectionTime = Date.now() - startTime;
    console.log(`✅ Database connected in ${connectionTime}ms`);

    // 🔥 ステップ2: データ取得（タイムアウト付き）
    console.log('📊 Fetching overview stats...');
    const data = await withTimeout(
      getOptimizedOverviewStats(),
      20000, // データ取得に20秒まで
      'data-fetching'
    );

    const totalTime = Date.now() - startTime;
    console.log(`✅ Stats fetched in ${totalTime}ms`);

    // 🔥 ステップ3: レスポンス返却
    // キャッシュヘッダー設定（重要：CDNキャッシュ活用）
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // 5分キャッシュ
    res.setHeader('X-Response-Time', `${totalTime}ms`);
    res.setHeader('X-Connection-Time', `${connectionTime}ms`);

    return res.status(200).json({
      success: true,
      message: 'Overview stats retrieved successfully',
      data,
      meta: {
        responseTime: totalTime,
        connectionTime,
        timestamp: new Date().toISOString(),
        connectionStats: getConnectionStats()
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ API Error (${totalTime}ms):`, error.message);

    // エラータイプ別の詳細ログ
    if (error.message.includes('timed out')) {
      console.error('🕐 TIMEOUT ERROR - Consider optimizing queries or increasing limits');
    } else if (error.message.includes('connection')) {
      console.error('🔌 CONNECTION ERROR - Check Atlas settings and network');
    }

    const errorResponse = createErrorResponse(error, 'データ取得');
    errorResponse.meta = {
      responseTime: totalTime,
      timestamp: new Date().toISOString()
    };

    // タイムアウトエラーは503、その他は500
    const statusCode = error.message.includes('timed out') ? 503 : 500;
    
    return res.status(statusCode).json(errorResponse);
  }
};