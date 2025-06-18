import { logger } from '../utils/logger.js';
import User from '../models/User.js';
import Result from '../models/Result.js';
import DailyProblemSet from '../models/DailyProblemSet.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';

// @desc    システム全体の統計情報取得
// @route   GET /api/admin/stats/overview
// @access  Private/Admin
export const getSystemOverview = async (req, res) => {
  try {
    logger.info('[Admin] システム統計の取得を開始');

    // 並列でデータを取得してパフォーマンス向上
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
          averageScore: { $avg: '$score' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          date: '$_id',
          totalChallenges: 1,
          averageScore: { $round: ['$averageScore', 1] },
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
        score: activity.score,
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
          averageScore: { $avg: '$score' },
          bestScore: { $max: '$score' },
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
      averageScore: Math.round(statsMap[user._id.toString()]?.averageScore || 0),
      bestScore: statsMap[user._id.toString()]?.bestScore || 0,
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
          averageScore: { $avg: '$score' },
          averageTime: { $avg: '$timeSpent' },
          averageCorrectAnswers: { $avg: '$correctAnswers' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          difficulty: '$_id',
          totalChallenges: 1,
          averageScore: { $round: ['$averageScore', 1] },
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
          averageScore: { $avg: '$score' },
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
          averageScore: { $round: ['$averageScore', 1] },
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
          score: 1,
          timeSpent: 1,
          difficulty: 1
        }
      },
      {
        $group: {
          _id: '$hour',
          totalChallenges: { $sum: 1 },
          averageScore: { $avg: '$score' },
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
          averageScore: { $round: ['$averageScore', 1] },
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
        averageScore: 0,
        averageTime: 0,
        difficultyDistribution: {}
      };
    });

    res.json({
      success: true,
      data: {
        period: `過去${days}日間`,
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