// Vercel Function: /api/admin-stats
// MongoDB Atlas対応版統合管理者統計API - 全統計エンドポイントを統合

const mongoose = require('mongoose');
const { connectMongoose } = require('./_lib/database');

// MongoDBスキーマ定義
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  grade: { type: Number, default: 1 },
  avatar: { type: String, default: '😊' },
  isAdmin: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const resultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String, required: true, index: true },
  grade: { type: Number, required: false, default: 0 },
  difficulty: { type: String, required: true, enum: ['beginner', 'intermediate', 'advanced', 'expert'], index: true },
  date: { type: String, required: true, index: true },
  totalProblems: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  incorrectAnswers: { type: Number, required: true },
  unanswered: { type: Number, required: true },
  score: { type: Number, required: true },
  timeSpent: { type: Number, required: true },
  totalTime: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  timestamp: { type: Date, default: Date.now }
});

const problemSetSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true },
  difficulty: { type: String, required: true, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
  problems: [{ type: Object }],
  isEdited: { type: Boolean, default: false }
});

// モデル定義
let User, Result, DailyProblemSet;
try {
  User = mongoose.model('User');
} catch {
  User = mongoose.model('User', userSchema);
}

try {
  Result = mongoose.model('Result');
} catch {
  Result = mongoose.model('Result', resultSchema);
}

try {
  DailyProblemSet = mongoose.model('DailyProblemSet');
} catch {
  DailyProblemSet = mongoose.model('DailyProblemSet', problemSetSchema);
}

// 統計処理関数
async function getOverviewStats() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalChallenges,
    challengesToday,
    problemSetsCount,
    recentActivity,
    weeklyStats
  ] = await Promise.all([
    User.countDocuments({}),
    Result.countDocuments({}),
    Result.countDocuments({ date: today }),
    DailyProblemSet.countDocuments({}),
    Result.find({ createdAt: { $gte: yesterday } }).sort({ createdAt: -1 }).limit(20).lean(),
    Result.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: '$date',
          totalChallenges: { $sum: 1 },
          averageCorrectRate: { $avg: { $multiply: [{ $divide: ['$correctAnswers', '$totalProblems'] }, 100] } },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      { $addFields: { uniqueUsers: { $size: '$uniqueUsers' } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  const activeUsersToday = await Result.distinct('userId', { date: today });

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
  const dbState = mongoose.connection.readyState;
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
  console.log(`📊 Admin Stats API: ${req.method} ${req.url}`);
  
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
    // タイムアウトを30秒に延長
    res.setMaxListeners(30);

    await connectMongoose();
    const { type, ...queryParams } = req.query;

    let data;
    switch (type) {
      case 'overview':
        data = await getOverviewStats();
        break;
      case 'difficulty':
        data = await getDifficultyStats(queryParams.period);
        break;
      case 'grade':
        data = await getGradeStats(queryParams.period);
        break;
      case 'hourly':
        data = await getHourlyStats(queryParams.days ? parseInt(queryParams.days, 10) : undefined);
        break;
      case 'system-health':
        data = await getSystemHealth();
        break;
      case 'performance':
        data = await getPerformanceStats();
        break;
      default:
        // Admin Dashboardのメインビュー用の統合データ
        const [
          overview, 
          difficulty, 
          grade, 
          hourly, 
          systemHealth,
          performance,
          // userGrowth, // 未実装のためコメントアウト
        ] = await Promise.all([
          getOverviewStats(),
          getDifficultyStats('week'),
          getGradeStats('week'),
          getHourlyStats(7),
          getSystemHealth(),
          getPerformanceStats(),
          // getUserGrowth('month'),
        ]);

        data = {
          overview,
          difficulty,
          grade,
          hourly,
          systemHealth,
          performance,
          // userGrowth
        };
        break;
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (error) {
    console.error(`[admin-stats-api] type: ${req.query.type} - Error:`, error);
    res.status(500).json({ message: 'Error fetching admin statistics', error: error.message });
  }
};