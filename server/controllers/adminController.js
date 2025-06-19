import { logger } from '../utils/logger.js';
import User from '../models/User.js';
import Result from '../models/Result.js';
import DailyProblemSet from '../models/DailyProblemSet.js';
import { getMockUsers, getMockResults, getMockDailyProblemSets } from '../config/database.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';

// モック環境かどうかを判定
const isMongoMock = () => process.env.MONGODB_MOCK === 'true';

// @desc    システム全体の統計情報取得
// @route   GET /api/admin/stats/overview
// @access  Private/Admin
export const getSystemOverview = async (req, res) => {
  try {
    logger.info('[Admin] システム統計の取得を開始');

    if (isMongoMock()) {
      // モック環境用の統計データ
      const mockUsers = getMockUsers();
      const mockResults = getMockResults();
      const mockProblemSets = getMockDailyProblemSets();
      const today = dayjs().format('YYYY-MM-DD');
      
      const overview = {
        totalUsers: mockUsers.length,
        activeUsersToday: mockResults.filter(r => r.date === today).length,
        totalChallenges: mockResults.length,
        challengesToday: mockResults.filter(r => r.date === today).length,
        problemSetsCount: mockProblemSets.length,
        weeklyStats: [
          { date: today, totalChallenges: 5, averageCorrectRate: 85.5, uniqueUsers: 2 },
          { date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), totalChallenges: 3, averageCorrectRate: 78.2, uniqueUsers: 2 },
          { date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'), totalChallenges: 7, averageCorrectRate: 82.1, uniqueUsers: 3 }
        ],
        recentActivity: mockResults.slice(-5).map((result, index) => ({
          id: `activity_${index}`,
          username: mockUsers.find(u => u._id === result.userId)?.username || 'Unknown',
          grade: mockUsers.find(u => u._id === result.userId)?.grade || 'N/A',
          difficulty: result.difficulty || 'beginner',
          correctAnswers: result.correctAnswers || 0,
          totalQuestions: result.totalQuestions || 10,
          date: result.date || today,
          createdAt: result.createdAt || new Date().toISOString()
        }))
      };

      logger.info('[Admin] モック統計データを返却');
      return res.json({
        success: true,
        data: overview
      });
    }

    // 通常のMongoose処理（以下は既存コード）
    const [
      totalUsers,
      activeUsersToday,
      totalChallenges,
      challengesToday,
      problemSetsCount,
      recentActivity
    ] = await Promise.all([
      // 総ユーザー数
      User.countDocuments({}),
      
      // 本日のアクティブユーザー数
      Result.distinct('userId', { 
        date: dayjs().format('YYYY-MM-DD') 
      }).then(userIds => userIds.length),
      
      // 総チャレンジ回数
      Result.countDocuments({}),
      
      // 本日のチャレンジ回数
      Result.countDocuments({ 
        date: dayjs().format('YYYY-MM-DD') 
      }),
      
      // 問題セット数
      DailyProblemSet.countDocuments({}),
      
      // 最近のアクティビティ（過去24時間）
      Result.find({ 
        createdAt: { $gte: dayjs().subtract(24, 'hour').toDate() } 
      })
      .populate('userId', 'username grade')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
    ]);

    // 週間統計
    const weeklyStats = await Result.aggregate([
      {
        $match: {
          date: {
            $gte: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
            $lte: dayjs().format('YYYY-MM-DD')
          }
        }
      },
      {
        $group: {
          _id: '$date',
          totalChallenges: { $sum: 1 },
          averageCorrectRate: { $avg: '$correctAnswers' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          date: '$_id',
          totalChallenges: 1,
          averageCorrectRate: { $round: ['$averageCorrectRate', 1] },
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // レスポンス作成
    const overview = {
      totalUsers,
      activeUsersToday,
      totalChallenges,
      challengesToday,
      problemSetsCount,
      weeklyStats,
      recentActivity: recentActivity.map(activity => ({
        id: activity._id,
        username: activity.userId?.username || '不明',
        grade: activity.userId?.grade || 'N/A',
        difficulty: activity.difficulty,
        correctAnswers: activity.correctAnswers || 0,
        totalQuestions: activity.totalQuestions || 10,
        date: activity.date,
        createdAt: activity.createdAt
      }))
    };

    logger.info('[Admin] システム統計の取得完了');
    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    logger.error('[Admin] システム統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'システム統計の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    ユーザー一覧取得（管理者用）
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      grade = '',
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    if (isMongoMock()) {
      // モック環境用のユーザー一覧
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
          lastActivity: userResults.length > 0 
            ? userResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
            : user.createdAt
        };
      });

      // ページネーション
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedUsers = enrichedUsers.slice(startIndex, endIndex);

      logger.info('[Admin] モックユーザー一覧を返却');
      return res.json({
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

    // 通常のMongoose処理
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

    // 統計データをマップ化
    const statsMap = userStats.reduce((map, stat) => {
      map[stat._id.toString()] = stat;
      return map;
    }, {});

    // ユーザーデータに統計を追加
    const enrichedUsers = users.map(user => ({
      ...user,
      totalChallenges: statsMap[user._id.toString()]?.totalChallenges || 0,
      averageCorrectRate: Math.round(statsMap[user._id.toString()]?.averageCorrectRate || 0),
      bestCorrectRate: statsMap[user._id.toString()]?.bestCorrectRate || 0,
      lastActivity: statsMap[user._id.toString()]?.lastActivity || user.createdAt
    }));

    res.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('[Admin] ユーザー一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー一覧の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    難易度別統計取得
// @route   GET /api/admin/stats/difficulty
// @access  Private/Admin
export const getDifficultyStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    if (isMongoMock()) {
      // モック環境用の難易度別統計
      const mockStats = [
        {
          difficulty: 'beginner',
          totalChallenges: 15,
          averageCorrectRate: 87.3,
          averageTime: 180.5,
          averageCorrectAnswers: 8.7,
          uniqueUsers: 2
        },
        {
          difficulty: 'intermediate',
          totalChallenges: 8,
          averageCorrectRate: 78.2,
          averageTime: 240.3,
          averageCorrectAnswers: 7.8,
          uniqueUsers: 2
        },
        {
          difficulty: 'advanced',
          totalChallenges: 3,
          averageCorrectRate: 65.7,
          averageTime: 320.1,
          averageCorrectAnswers: 6.6,
          uniqueUsers: 1
        },
        {
          difficulty: 'expert',
          totalChallenges: 1,
          averageCorrectRate: 45.0,
          averageTime: 420.0,
          averageCorrectAnswers: 4.5,
          uniqueUsers: 1
        }
      ];

      logger.info('[Admin] モック難易度別統計を返却');
      return res.json({
        success: true,
        data: {
          period,
          stats: mockStats
        }
      });
    }
    
    // 通常のMongoose処理
    // 期間設定
    let startDate;
    switch (period) {
      case 'today':
        startDate = dayjs().format('YYYY-MM-DD');
        break;
      case 'week':
        startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
        break;
      case 'month':
        startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
        break;
      default:
        startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    }

    const difficultyStats = await Result.aggregate([
      {
        $match: {
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$difficulty',
          totalChallenges: { $sum: 1 },
          averageCorrectRate: { $avg: '$correctAnswers' },
          averageTime: { $avg: '$timeSpent' },
          averageCorrectAnswers: { $avg: '$correctAnswers' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          difficulty: '$_id',
          totalChallenges: 1,
          averageCorrectRate: { $round: ['$averageCorrectRate', 1] },
          averageTime: { $round: ['$averageTime', 1] },
          averageCorrectAnswers: { $round: ['$averageCorrectAnswers', 1] },
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { difficulty: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        period,
        stats: difficultyStats
      }
    });

  } catch (error) {
    logger.error('[Admin] 難易度別統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '難易度別統計の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    学年別統計取得
// @route   GET /api/admin/stats/grade
// @access  Private/Admin
export const getGradeStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    if (isMongoMock()) {
      // モック環境用の学年別統計
      const mockStats = [
        {
          grade: 1,
          totalChallenges: 5,
          averageCorrectRate: 85.2,
          averageTime: 200.3,
          uniqueUsers: 1,
          difficultyDistribution: { beginner: 4, intermediate: 1 }
        },
        {
          grade: 2,
          totalChallenges: 8,
          averageCorrectRate: 78.5,
          averageTime: 180.7,
          uniqueUsers: 1,
          difficultyDistribution: { beginner: 6, intermediate: 2 }
        },
        {
          grade: 3,
          totalChallenges: 12,
          averageCorrectRate: 82.1,
          averageTime: 220.5,
          uniqueUsers: 1,
          difficultyDistribution: { beginner: 5, intermediate: 4, advanced: 3 }
        }
      ];

      logger.info('[Admin] モック学年別統計を返却');
      return res.json({
        success: true,
        data: {
          period,
          stats: mockStats
        }
      });
    }
    
    // 通常のMongoose処理
    // 期間設定
    let startDate;
    switch (period) {
      case 'today':
        startDate = dayjs().format('YYYY-MM-DD');
        break;
      case 'week':
        startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
        break;
      case 'month':
        startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
        break;
      default:
        startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    }

    const gradeStats = await Result.aggregate([
      {
        $match: {
          date: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId', 
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $group: {
          _id: '$user.grade',
          totalChallenges: { $sum: 1 },
          averageCorrectRate: { $avg: '$correctAnswers' },
          averageTime: { $avg: '$timeSpent' },
          uniqueUsers: { $addToSet: '$userId' },
          difficultyBreakdown: {
            $push: '$difficulty'
          }
        }
      },
      {
        $project: {
          grade: '$_id',
          totalChallenges: 1,
          averageCorrectRate: { $round: ['$averageCorrectRate', 1] },
          averageTime: { $round: ['$averageTime', 1] },
          uniqueUsers: { $size: '$uniqueUsers' },
          difficultyBreakdown: 1
        }
      },
      { $sort: { grade: 1 } }
    ]);

    // 各学年の難易度別分布を計算
    const enrichedStats = gradeStats.map(stat => {
      const difficultyCount = stat.difficultyBreakdown.reduce((acc, diff) => {
        acc[diff] = (acc[diff] || 0) + 1;
        return acc;
      }, {});
      
      return {
        ...stat,
        difficultyDistribution: difficultyCount
      };
    });

    res.json({
      success: true,
      data: {
        period,
        stats: enrichedStats
      }
    });

  } catch (error) {
    logger.error('[Admin] 学年別統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '学年別統計の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    時間帯別統計取得
// @route   GET /api/admin/stats/hourly
// @access  Private/Admin
export const getHourlyStats = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    if (isMongoMock()) {
      // モック環境用の時間帯別統計（6-8時のみデータ）
      const mockHourlyStats = Array.from({ length: 24 }, (_, hour) => {
        if (hour >= 6 && hour <= 8) {
          return {
            hour,
            totalChallenges: hour === 7 ? 15 : 5, // 7時が最も多い
            averageCorrectRate: 80 + (hour - 6) * 2, // 6時:80, 7時:82, 8時:84
            averageTime: 200 - (hour - 6) * 10, // 6時:200s, 7時:190s, 8時:180s
            difficultyDistribution: {
              beginner: hour === 7 ? 8 : 3,
              intermediate: hour === 7 ? 5 : 2,
              advanced: hour === 7 ? 2 : 0
            }
          };
        }
        return {
          hour,
          totalChallenges: 0,
          averageCorrectRate: 0,
          averageTime: 0,
          difficultyDistribution: {}
        };
      });

      logger.info('[Admin] モック時間帯別統計を返却');
      return res.json({
        success: true,
        data: {
          days: parseInt(days),
          stats: mockHourlyStats
        }
      });
    }
    
    // 通常のMongoose処理
    const startDate = dayjs().subtract(parseInt(days), 'day').toDate();

    const hourlyStats = await Result.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $project: {
          hour: { $hour: '$createdAt' },
          correctAnswers: 1,
          timeSpent: 1,
          difficulty: 1
        }
      },
      {
        $group: {
          _id: '$hour',
          totalChallenges: { $sum: 1 },
          averageCorrectRate: { $avg: '$correctAnswers' },
          averageTime: { $avg: '$timeSpent' },
          difficultyBreakdown: {
            $push: '$difficulty'
          }
        }
      },
      {
        $project: {
          hour: '$_id',
          totalChallenges: 1,
          averageCorrectRate: { $round: ['$averageCorrectRate', 1] },
          averageTime: { $round: ['$averageTime', 1] },
          difficultyBreakdown: 1
        }
      },
      { $sort: { hour: 1 } }
    ]);

    // 0-23時間の配列を作成（データがない時間帯は0で埋める）
    const fullHourlyStats = Array.from({ length: 24 }, (_, hour) => {
      const stat = hourlyStats.find(s => s.hour === hour);
      if (stat) {
        // 難易度分布を計算
        const difficultyCount = stat.difficultyBreakdown.reduce((acc, diff) => {
          acc[diff] = (acc[diff] || 0) + 1;
          return acc;
        }, {});
        
        return {
          ...stat,
          difficultyDistribution: difficultyCount
        };
      }
      return {
        hour,
        totalChallenges: 0,
        averageCorrectRate: 0,
        averageTime: 0,
        difficultyDistribution: {}
      };
    });

    res.json({
      success: true,
      data: {
        days: parseInt(days),
        stats: fullHourlyStats
      }
    });

  } catch (error) {
    logger.error('[Admin] 時間帯別統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '時間帯別統計の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    問題セット管理統計
// @route   GET /api/admin/stats/problemsets
// @access  Private/Admin
export const getProblemSetStats = async (req, res) => {
  try {
    if (isMongoMock()) {
      // モック環境用の問題セット統計
      const mockStats = {
        difficultyBreakdown: [
          {
            difficulty: 'beginner',
            totalSets: 1,
            averageProblems: 10.0,
            oldestDate: dayjs().format('YYYY-MM-DD'),
            newestDate: dayjs().format('YYYY-MM-DD')
          },
          {
            difficulty: 'intermediate',
            totalSets: 1,
            averageProblems: 10.0,
            oldestDate: dayjs().format('YYYY-MM-DD'),
            newestDate: dayjs().format('YYYY-MM-DD')
          },
          {
            difficulty: 'advanced',
            totalSets: 1,
            averageProblems: 10.0,
            oldestDate: dayjs().format('YYYY-MM-DD'),
            newestDate: dayjs().format('YYYY-MM-DD')
          },
          {
            difficulty: 'expert',
            totalSets: 1,
            averageProblems: 10.0,
            oldestDate: dayjs().format('YYYY-MM-DD'),
            newestDate: dayjs().format('YYYY-MM-DD')
          }
        ],
        usage: {
          totalProblemSets: 4,
          usedProblemSets: 2,
          unusedProblemSets: 2
        }
      };

      logger.info('[Admin] モック問題セット統計を返却');
      return res.json({
        success: true,
        data: mockStats
      });
    }

    // 通常のMongoose処理
    // 問題セットの基本統計
    const problemSetStats = await DailyProblemSet.aggregate([
      {
        $group: {
          _id: '$difficulty',
          totalSets: { $sum: 1 },
          averageProblems: { $avg: { $size: '$problems' } },
          oldestDate: { $min: '$date' },
          newestDate: { $max: '$date' }
        }
      },
      {
        $project: {
          difficulty: '$_id',
          totalSets: 1,
          averageProblems: { $round: ['$averageProblems', 1] },
          oldestDate: 1,
          newestDate: 1
        }
      },
      { $sort: { difficulty: 1 } }
    ]);

    // 利用状況（Results コレクションとの結合）
    const usageStats = await DailyProblemSet.aggregate([
      {
        $lookup: {
          from: 'results',
          let: { date: '$date', difficulty: '$difficulty' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$date', '$$date'] },
                    { $eq: ['$difficulty', '$$difficulty'] }
                  ]
                }
              }
            }
          ],
          as: 'usage'
        }
      },
      {
        $project: {
          date: 1,
          difficulty: 1,
          problemCount: { $size: '$problems' },
          usageCount: { $size: '$usage' },
          isUsed: { $gt: [{ $size: '$usage' }, 0] }
        }
      },
      {
        $group: {
          _id: null,
          totalProblemSets: { $sum: 1 },
          usedProblemSets: {
            $sum: { $cond: ['$isUsed', 1, 0] }
          },
          unusedProblemSets: {
            $sum: { $cond: ['$isUsed', 0, 1] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        difficultyBreakdown: problemSetStats,
        usage: usageStats[0] || {
          totalProblemSets: 0,
          usedProblemSets: 0,
          unusedProblemSets: 0
        }
      }
    });

  } catch (error) {
    logger.error('[Admin] 問題セット統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '問題セット統計の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 