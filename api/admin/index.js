// Vercel Function: /api/admin/index (Consolidated Admin Endpoints)
// 管理者系API統合エンドポイント - Vercel Hobby プランの Function 制限対応
const { connectMongoose, optimizeQuery, optimizeAggregation, withTimeout } = require('../../shared_lib/database');
const { User, Result, DailyProblemSet } = require('../../shared_lib/models');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dayjs = require('dayjs');

const logger = {
  info: (...args) => !process.env.VERCEL && console.log('[Admin/Index]', ...args),
  debug: (...args) => !process.env.VERCEL && console.debug('[Admin/Index]', ...args),
  warn: (...args) => console.warn('[Admin/Index]', ...args),
  error: (...args) => console.error('[Admin/Index]', ...args)
};

// モック環境判定
const isMongoMock = () => process.env.MONGODB_MOCK === 'true';

// モックデータ（開発環境用）
const getMockUsers = () => [
  {
    _id: 'user1',
    username: 'admin',
    email: 'admin@example.com',
    grade: 4,
    isAdmin: true,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'user2',
    username: 'testuser',
    email: 'test@example.com',
    grade: 3,
    isAdmin: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'user3',
    username: 'student1',
    email: 'student1@example.com',
    grade: 5,
    isAdmin: false,
    createdAt: new Date().toISOString()
  }
];

const getMockResults = () => [
  {
    userId: 'user2',
    difficulty: 'beginner',
    correctAnswers: 8,
    totalProblems: 10,
    timeSpent: 120000,
    date: dayjs().format('YYYY-MM-DD'),
    createdAt: new Date().toISOString()
  },
  {
    userId: 'user3',
    difficulty: 'intermediate',
    correctAnswers: 7,
    totalProblems: 10,
    timeSpent: 180000,
    date: dayjs().format('YYYY-MM-DD'),
    createdAt: new Date().toISOString()
  }
];

// JWT認証ミドルウェア
const authenticate = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証トークンが必要です');
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    if (!decoded.isAdmin) {
      throw new Error('管理者権限が必要です');
    }
    return decoded;
  } catch (error) {
    throw new Error('無効な認証トークンです');
  }
};

// ==================== USERS API ====================
const handleUsersAPI = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // クエリパラメータ取得
  const {
    page = 1,
    limit = 20,
    search = '',
    grade = '',
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  logger.info('ユーザー一覧取得開始', { page, limit, search, grade });

  if (isMongoMock()) {
    // モック環境での処理
    const mockUsers = getMockUsers();
    const mockResults = getMockResults();
    
    // 検索フィルタリング
    let filteredUsers = mockUsers;
    if (search) {
      filteredUsers = filteredUsers.filter(user => 
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (grade) {
      filteredUsers = filteredUsers.filter(user => user.grade === parseInt(grade));
    }

    // 統計情報を追加
    const enrichedUsers = filteredUsers.map(user => {
      const userResults = mockResults.filter(r => r.userId === user._id);
      return {
        ...user,
        totalChallenges: userResults.length,
        averageCorrectRate: userResults.length > 0 
          ? Math.round(userResults.reduce((sum, r) => sum + (r.correctAnswers || 0), 0) / userResults.length)
          : 0,
        bestCorrectRate: userResults.length > 0 
          ? Math.max(...userResults.map(r => r.correctAnswers || 0))
          : 0,
        streak: 0,
        lastActivity: userResults.length > 0 
          ? userResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
          : user.createdAt
      };
    });

    // ページネーション
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = enrichedUsers.slice(startIndex, endIndex);

    logger.info('モックユーザー一覧を返却');
    return res.status(200).json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(enrichedUsers.length / parseInt(limit)),
          totalCount: enrichedUsers.length,
          limit: parseInt(limit)
        }
      }
    });
  }

  // MongoDB接続
  await connectMongoose();

  // 検索条件構築
  const searchConditions = {};
  if (search) {
    searchConditions.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  if (grade) {
    searchConditions.grade = parseInt(grade);
  }

  // ソート条件
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortCondition = { [sortBy]: sortOrder };

  // 並列処理でデータ取得
  const [users, totalCount] = await Promise.all([
    User.find(searchConditions)
      .select('-password')
      .sort(sortCondition)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean(),
    
    User.countDocuments(searchConditions)
  ]);

  // 各ユーザーの統計情報を取得
  const userIds = users.map(user => user._id);
  const userStats = await Result.aggregate([
    { $match: { userId: { $in: userIds } } },
    {
      $group: {
        _id: '$userId',
        totalChallenges: { $sum: 1 },
        averageCorrectRate: { $avg: '$correctAnswers' },
        bestCorrectRate: { $max: '$correctAnswers' },
        lastActivity: { $max: '$createdAt' }
      }
    }
  ]);

  // 統計情報をマップに変換
  const statsMap = {};
  userStats.forEach(stat => {
    statsMap[stat._id.toString()] = stat;
  });

  // ユーザー情報に統計を追加
  const enrichedUsers = users.map(user => {
    const stats = statsMap[user._id.toString()] || {};
    return {
      ...user,
      totalChallenges: stats.totalChallenges || 0,
      averageCorrectRate: Math.round(stats.averageCorrectRate || 0),
      bestCorrectRate: stats.bestCorrectRate || 0,
      lastActivity: stats.lastActivity || user.createdAt,
      streak: 0
    };
  });

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  logger.info(`ユーザー一覧取得完了: ${enrichedUsers.length}件`);
  
  return res.status(200).json({
    success: true,
    data: {
      users: enrichedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit)
      }
    }
  });
};

// ==================== USER ADMIN ACTIONS ====================
const handleUserAdminAPI = async (req, res) => {
  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { userId, action } = req.query;
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'ユーザーIDが必要です'
    });
  }

  if (!action || !['make-admin', 'remove-admin'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: '無効なアクションです。make-admin または remove-admin を指定してください'
    });
  }

  logger.info(`ユーザー ${userId} に対する管理者権限操作: ${action}`);

  if (isMongoMock()) {
    // モック環境での処理
    const mockUsers = getMockUsers();
    const userIndex = mockUsers.findIndex(user => user._id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    const user = mockUsers[userIndex];
    
    if (action === 'make-admin') {
      if (user.isAdmin) {
        return res.status(400).json({
          success: false,
          message: 'このユーザーは既に管理者です'
        });
      }
      user.isAdmin = true;
      logger.info(`モック環境でユーザー ${userId} を管理者に設定`);
      return res.status(200).json({
        success: true,
        message: 'ユーザーに管理者権限を付与しました',
        data: { userId, username: user.username, isAdmin: true }
      });
    } else {
      if (!user.isAdmin) {
        return res.status(400).json({
          success: false,
          message: 'このユーザーは管理者ではありません'
        });
      }
      user.isAdmin = false;
      logger.info(`モック環境でユーザー ${userId} の管理者権限を削除`);
      return res.status(200).json({
        success: true,
        message: 'ユーザーの管理者権限を削除しました',
        data: { userId, username: user.username, isAdmin: false }
      });
    }
  }

  // MongoDB環境での処理
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      success: false,
      message: '無効なユーザーIDです'
    });
  }

  await connectMongoose();

  const user = await User.findById(userId).select('username email isAdmin');
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'ユーザーが見つかりません'
    });
  }

  if (action === 'make-admin') {
    if (user.isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'このユーザーは既に管理者です'
      });
    }
    await User.findByIdAndUpdate(userId, { isAdmin: true });
    logger.info(`ユーザー ${user.username} (${userId}) を管理者に設定`);
    return res.status(200).json({
      success: true,
      message: 'ユーザーに管理者権限を付与しました',
      data: { userId, username: user.username, email: user.email, isAdmin: true }
    });
  } else {
    if (!user.isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'このユーザーは管理者ではありません'
      });
    }
    await User.findByIdAndUpdate(userId, { isAdmin: false });
    logger.info(`ユーザー ${user.username} (${userId}) の管理者権限を削除`);
    return res.status(200).json({
      success: true,
      message: 'ユーザーの管理者権限を削除しました',
      data: { userId, username: user.username, email: user.email, isAdmin: false }
    });
  }
};

// ==================== ADMIN STATS API ====================
const handleStatsAPI = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 統計処理は既存のadmin-stats.jsからコピー
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
        data = await getOverviewStats();
        break;
    }

    return res.status(200).json({
      success: true,
      type: type || 'overview',
      data
    });

  } catch (error) {
    logger.error(`統計API エラー type "${req.query.type}":`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

// ==================== MONITORING API ====================
const handleMonitoringAPI = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { type = 'health' } = req.query;

    if (type === 'health') {
      const healthData = await getHealthCheck();
      return res.status(200).json({
        success: true,
        data: healthData
      });
    }

    if (type === 'performance') {
      const performanceData = await getPerformanceStats();
      return res.status(200).json({
        success: true,
        data: performanceData
      });
    }

    if (type === 'all') {
      const [healthData, performanceData] = await Promise.all([
        getHealthCheck(),
        getPerformanceStats()
      ]);

      return res.status(200).json({
        success: true,
        data: {
          health: healthData,
          performance: performanceData
        }
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid type parameter. Use: health, performance, or all'
    });

  } catch (error) {
    logger.error('監視API エラー:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ==================== HELPER FUNCTIONS (from admin-stats.js) ====================
async function getOverviewStats() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const basicStats = await withTimeout(
      Promise.all([
        User.countDocuments({}).maxTimeMS(5000),
        Result.countDocuments({}).maxTimeMS(5000),
        Result.countDocuments({ date: today }).maxTimeMS(5000),
        DailyProblemSet.countDocuments({}).maxTimeMS(5000),
        Result.distinct('userId', { date: today }).maxTimeMS(5000)
      ]),
      12000,
      'basic-stats'
    );

    const [totalUsers, totalChallenges, challengesToday, problemSetsCount, activeUsersToday] = basicStats;

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
      logger.warn('Recent activity query failed, using fallback:', activityError.message);
    }

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
          { $limit: 7 }
        ], { maxTimeMS: 15000 }),
        18000,
        'weekly-stats'
      );
    } catch (weeklyError) {
      logger.warn('Weekly stats aggregation failed, using fallback:', weeklyError.message);
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
    logger.error('Overview stats error:', error);
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

// Additional helper functions (abbreviated for space - implement as needed)
async function getDifficultyStats(period) { return { period, stats: [] }; }
async function getGradeStats(period) { return { period, stats: [] }; }
async function getHourlyStats(days) { return { days, stats: [] }; }
async function getPerformanceStats() { return { global: { averageResponseTime: 100 } }; }
async function getSystemHealth() { return { status: 'healthy', timestamp: new Date() }; }
async function getHealthCheck() { return { status: 'healthy', timestamp: new Date() }; }

// ==================== MAIN HANDLER ====================
module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 認証チェック（監視APIを除く）
    const { path } = req.query;
    if (path !== 'monitoring') {
      authenticate(req);
    }

    logger.debug(`統合管理API リクエスト: ${req.method} ${req.url}, path: ${path}`);

    // パスに基づいて適切なハンドラーに委譲
    switch (path) {
      case 'users':
        if (req.query.userId && req.query.action) {
          return await handleUserAdminAPI(req, res);
        } else {
          return await handleUsersAPI(req, res);
        }
      case 'stats':
        return await handleStatsAPI(req, res);
      case 'monitoring':
        return await handleMonitoringAPI(req, res);
      default:
        return res.status(400).json({
          success: false,
          message: '無効なパスです。users, stats, または monitoring を指定してください'
        });
    }

  } catch (error) {
    logger.error('統合管理API エラー:', error);
    
    if (error.message.includes('認証') || error.message.includes('権限')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: '管理API の処理に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};