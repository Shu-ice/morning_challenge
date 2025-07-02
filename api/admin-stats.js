// Vercel Function: /api/admin-stats
// 🚀 最適化版 - グローバルキャッシュと一元化モデルを使用

const { connectMongoose, optimizeQuery, optimizeAggregation, withTimeout } = require('../shared_lib/database');
const { User, Result, DailyProblemSet } = require('../shared_lib/models');

// 🚀 最適化された統計処理関数
async function getOverviewStats() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 🔥 Step 1: 基本統計（軽量クエリ）を並列実行
    const basicStats = await withTimeout(
      Promise.all([
        User.countDocuments({}).maxTimeMS(5000),
        Result.countDocuments({}).maxTimeMS(5000),
        Result.countDocuments({ date: today }).maxTimeMS(5000),
        DailyProblemSet.countDocuments({}).maxTimeMS(5000),
        Result.distinct('userId', { date: today }).maxTimeMS(5000)
      ]),
      12000, // 12秒でタイムアウト
      'basic-stats'
    );

    const [totalUsers, totalChallenges, challengesToday, problemSetsCount, activeUsersToday] = basicStats;

    // 🔥 Step 2: 最近のアクティビティ（制限付き）
    let recentActivity = [];
    try {
      const recentResults = await withTimeout(
        optimizeQuery(
          Result.find({ createdAt: { $gte: yesterday } })
            .select('username grade difficulty correctAnswers totalProblems timeSpent date createdAt')
            .sort({ createdAt: -1 }),
          { maxTimeMS: 8000, lean: true, maxDocs: 20 }
        ),
        10000,
        'recent-activity'
      );
      recentActivity = recentResults;
    } catch (activityError) {
      console.warn('Recent activity query failed, using fallback:', activityError.message);
      // 空配列でフォールバック
    }

    // 🔥 Step 3: 週間統計（重い集計）- フォールバック付き
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
        ], { maxTimeMS: 15000 }),
        18000,
        'weekly-stats'
      );
    } catch (weeklyError) {
      console.warn('Weekly stats aggregation failed, using fallback:', weeklyError.message);
      // フォールバック：基本統計のみ
      weeklyStats = [{
        _id: today,
        totalChallenges: challengesToday,
        averageCorrectRate: 0,
        uniqueUsers: activeUsersToday.length
      }];
    }

    return {
      totalUsers,
      activeUsersToday: activeUsersToday.length,
      totalChallenges,
      challengesToday,
      problemSetsCount,
      weeklyStats: weeklyStats.map(stat => ({
        date: stat._id,
        totalChallenges: stat.totalChallenges,
        averageCorrectRate: Math.round(stat.averageCorrectRate || 0),
        uniqueUsers: stat.uniqueUsers
      })),
      recentActivity: recentActivity.map(activity => ({
        id: activity._id.toString(),
        username: activity.username,
        grade: activity.grade,
        difficulty: activity.difficulty,
        correctAnswers: activity.correctAnswers,
        totalProblems: activity.totalProblems,
        timeSpent: activity.timeSpent,
        date: activity.date,
        createdAt: activity.createdAt.toISOString()
      }))
    };

  } catch (error) {
    console.error('Overview stats error:', error);
    // 🔥 フォールバック：基本的なデータのみ返す
    return {
      totalUsers: 0,
      activeUsersToday: 0,
      totalChallenges: 0,
      challengesToday: 0,
      problemSetsCount: 0,
      weeklyStats: [],
      recentActivity: [],
      _error: error.message
    };
  }
}

async function getDifficultyStats(period = 'week') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'week':
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
  }

  const difficultyStats = await Result.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$difficulty',
        totalChallenges: { $sum: 1 },
        totalCorrectAnswers: { $sum: '$correctAnswers' },
        totalProblems: { $sum: '$totalProblems' },
        totalTimeSpent: { $sum: '$timeSpent' },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueUsers: { $size: '$uniqueUsers' },
        averageCorrectRate: { $round: [{ $multiply: [{ $divide: ['$totalCorrectAnswers', '$totalProblems'] }, 100] }, 1] },
        averageTime: { $round: [{ $divide: ['$totalTimeSpent', '$totalChallenges'] }, 1] },
        averageCorrectAnswers: { $round: [{ $divide: ['$totalCorrectAnswers', '$totalChallenges'] }, 1] }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const difficultyOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
  const orderedStats = difficultyOrder.map(difficulty => {
    const stat = difficultyStats.find(s => s._id === difficulty);
    return stat || {
      _id: difficulty,
      totalChallenges: 0,
      uniqueUsers: 0,
      averageCorrectRate: 0,
      averageTime: 0,
      averageCorrectAnswers: 0
    };
  });

  return {
    period,
    stats: orderedStats.map(stat => ({
      difficulty: stat._id,
      totalChallenges: stat.totalChallenges,
      uniqueUsers: stat.uniqueUsers,
      averageCorrectRate: stat.averageCorrectRate || 0,
      averageTime: stat.averageTime || 0,
      averageCorrectAnswers: stat.averageCorrectAnswers || 0
    }))
  };
}

async function getGradeStats(period = 'week') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'week':
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
  }

  const gradeStats = await Result.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$grade',
        totalChallenges: { $sum: 1 },
        totalCorrectAnswers: { $sum: '$correctAnswers' },
        totalProblems: { $sum: '$totalProblems' },
        totalTimeSpent: { $sum: '$timeSpent' },
        uniqueUsers: { $addToSet: '$userId' },
        difficultyBreakdown: { $push: '$difficulty' }
      }
    },
    {
      $addFields: {
        uniqueUsers: { $size: '$uniqueUsers' },
        averageCorrectRate: { $round: [{ $multiply: [{ $divide: ['$totalCorrectAnswers', '$totalProblems'] }, 100] }, 1] },
        averageTime: { $round: [{ $divide: ['$totalTimeSpent', '$totalChallenges'] }, 1] }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const processedStats = gradeStats.map(stat => {
    const difficultyDistribution = {};
    stat.difficultyBreakdown.forEach(difficulty => {
      difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
    });

    return {
      grade: stat._id || 0,
      totalChallenges: stat.totalChallenges,
      uniqueUsers: stat.uniqueUsers,
      averageCorrectRate: stat.averageCorrectRate || 0,
      averageTime: stat.averageTime || 0,
      difficultyDistribution
    };
  });

  return { period, stats: processedStats };
}

async function getHourlyStats(days = 7) {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const hourlyStats = await Result.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $addFields: { hour: { $hour: '$createdAt' } } },
    {
      $group: {
        _id: '$hour',
        totalChallenges: { $sum: 1 },
        totalCorrectAnswers: { $sum: '$correctAnswers' },
        totalProblems: { $sum: '$totalProblems' },
        totalTimeSpent: { $sum: '$timeSpent' },
        difficultyBreakdown: { $push: '$difficulty' }
      }
    },
    {
      $addFields: {
        averageCorrectRate: { $round: [{ $multiply: [{ $divide: ['$totalCorrectAnswers', '$totalProblems'] }, 100] }, 1] },
        averageTime: { $round: [{ $divide: ['$totalTimeSpent', '$totalChallenges'] }, 1] }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const fullHourlyStats = [];
  for (let hour = 0; hour < 24; hour++) {
    const stat = hourlyStats.find(s => s._id === hour);
    
    if (stat) {
      const difficultyDistribution = {};
      stat.difficultyBreakdown.forEach(difficulty => {
        difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
      });

      fullHourlyStats.push({
        hour,
        totalChallenges: stat.totalChallenges,
        averageCorrectRate: stat.averageCorrectRate || 0,
        averageTime: stat.averageTime || 0,
        difficultyDistribution
      });
    } else {
      fullHourlyStats.push({
        hour,
        totalChallenges: 0,
        averageCorrectRate: 0,
        averageTime: 0,
        difficultyDistribution: {}
      });
    }
  }

  return { days, stats: fullHourlyStats };
}

async function getPerformanceStats() {
  // ここではパフォーマンス統計をモックまたは単純な計算で生成します。
  // 将来的に実際のメトリクスを収集するロジックに置き換えることができます。
  return {
    global: {
      averageResponseTime: Math.random() * 80 + 40, // 40-120ms
      totalRequests: Math.floor(Math.random() * 5000) + 1000, // 1000-6000
      errorRate: Math.random() * 0.02, // 0-2%
    },
    endpoints: {
      '/api/rankings': { averageResponseTime: Math.random() * 150 + 50, requests: Math.floor(Math.random() * 2000) },
      '/api/problems/generate': { averageResponseTime: Math.random() * 250 + 100, requests: Math.floor(Math.random() * 300) },
      '/api/auth/login': { averageResponseTime: Math.random() * 100 + 30, requests: Math.floor(Math.random() * 1000) },
    }
  };
}

async function getSystemHealth() {
  const dbState = require('mongoose').connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
  const isHealthy = dbStatus === 'connected';

  return {
    status: isHealthy ? 'healthy' : 'error',
    databaseStatus: dbStatus,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      nodeVersion: process.version
    }
  };
}

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // 認証チェック（シンプル版）
  // TODO: より堅牢な認証ミドルウェアに置き換える
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }
  // ここでトークンの検証を行うのが理想

  try {
    // 🚀 最適化されたDB接続
    await connectMongoose();

    const { type, period = 'week', days = 7 } = req.query;
    let data;

    switch (type) {
      case 'overview':
        data = await getOverviewStats();
        break;
      case 'difficulty':
        data = await getDifficultyStats(period);
        break;
      case 'grade':
        data = await getGradeStats(period);
        break;
      case 'hourly':
        data = await getHourlyStats(Number(days));
        break;
      case 'performance':
        data = await getPerformanceStats();
        break;
      case 'health':
        data = await getSystemHealth();
        break;
      default:
        // デフォルトは overview を返す
        data = await getOverviewStats();
        break;
    }

        return res.status(200).json({
          success: true,
      type: type || 'overview',
      data
    });

  } catch (error) {
    console.error(`[admin-stats] Error for type "${req.query.type}":`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
}; 