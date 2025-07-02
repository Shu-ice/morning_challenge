// Vercel Function: /api/admin/users
// 管理者用ユーザー管理API
const { connectMongoose } = require('../../shared_lib/database');
const { User, Result } = require('../../shared_lib/models');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');

const logger = {
  info: (...args) => !process.env.VERCEL && console.log('[Admin/Users]', ...args),
  debug: (...args) => !process.env.VERCEL && console.debug('[Admin/Users]', ...args),
  warn: (...args) => console.warn('[Admin/Users]', ...args),
  error: (...args) => console.error('[Admin/Users]', ...args)
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

module.exports = async function handler(req, res) {
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
      message: 'Method not allowed' 
    });
  }

  try {
    // 認証チェック
    authenticate(req);

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
          streak: 0, // 簡略化
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
        streak: 0 // TODO: 実装する場合は連続ログインの計算
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

  } catch (error) {
    logger.error('ユーザー一覧取得エラー:', error);
    
    if (error.message.includes('認証') || error.message.includes('権限')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'ユーザー一覧の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};