import Result from '../models/Result.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    日間ランキングの取得
// @route   GET /api/rankings/daily
// @access  Public
export const getDailyRankings = async (req, res) => {
  try {
    // リクエストで指定された日付を使用、なければ今日の日付
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    
    console.log(`[Ranking] 日間ランキング取得: date=${targetDate}, difficulty=${req.query.difficulty || 'all'}`);
    
    // 難易度フィルタリング
    const filterConditions = {
      date: targetDate, // 指定された日付のデータを取得
    };
    if (req.query.difficulty) {
      filterConditions.difficulty = req.query.difficulty;
    }
    
    // ランキングの取得（最大50件、limitが指定されていればそれを使用）
    const limit = parseInt(req.query.limit) || 50;
    const rankings = await Result.find(filterConditions)
      .sort({ score: -1, timeSpent: 1, createdAt: 1 })
      .limit(limit)
      .populate('userId', 'username avatar grade streak')
      .lean();
    
    console.log(`[Ranking] 取得件数: ${rankings.length}件`);
    
    if (!rankings.length) {
      return res.json({
        success: true,
        date: targetDate,
        message: `${targetDate}のランキングデータがありません`,
        data: []
      });
    }
    
    // ランキングデータの整形
    const formattedRankings = rankings.map((result, index) => {
      // populateが成功しているか確認
      if (!result.userId) {
        console.error(`User data not populated for result ID: ${result._id}. Skipping this result.`);
        return null;
      }
      return {
        rank: index + 1,
        userId: result.userId._id,
        username: result.userId.username,
        avatar: result.userId.avatar,
        grade: result.userId.grade,
        difficulty: result.difficulty,
        score: result.score,
        timeSpent: result.timeSpent,
        totalTime: result.totalTime, // フロントエンドで使用される
        correctAnswers: result.correctAnswers,
        totalProblems: result.totalProblems,
        incorrectAnswers: result.incorrectAnswers,
        unanswered: result.unanswered,
        streak: result.userId.streak,
        date: result.date
      };
    }).filter(Boolean); // nullを除去
    
    res.json({
      success: true,
      date: targetDate,
      count: formattedRankings.length,
      data: formattedRankings
    });
  } catch (error) {
    console.error("Error in getDailyRankings:", error);
    res.status(500).json({ 
      success: false,
      message: 'ランキングの取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    週間ランキングの取得
// @route   GET /api/rankings/weekly
// @access  Public
export const getWeeklyRankings = async (req, res) => {
  try {
    // 週の始まり（日曜日の0時）を計算
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0が日曜日
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startDateStr = startOfWeek.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];
    
    console.log(`[Ranking] 週間ランキング取得: ${startDateStr} - ${endDateStr}`);
    
    // 難易度フィルタリング
    const matchConditions = {
      date: { 
        $gte: startDateStr,
        $lte: endDateStr
      }
    };
    if (req.query.difficulty) {
      matchConditions.difficulty = req.query.difficulty;
    }
    
    // 各ユーザーごとに最高スコアを集計（期間内の最高記録）
    const aggregatedRankings = await Result.aggregate([
      { $match: matchConditions },
      { $sort: { score: -1, timeSpent: 1 } },
      {
        $group: {
          _id: '$userId',
          score: { $max: '$score' },
          timeSpent: { $first: '$timeSpent' },
          totalTime: { $first: '$totalTime' },
          correctAnswers: { $first: '$correctAnswers' },
          totalProblems: { $first: '$totalProblems' },
          difficulty: { $first: '$difficulty' },
          date: { $first: '$date' }
        }
      },
      { $sort: { score: -1, timeSpent: 1 } },
      { $limit: parseInt(req.query.limit) || 50 }
    ]);
    
    if (!aggregatedRankings.length) {
      return res.json({
        success: true,
        startDate: startDateStr,
        endDate: endDateStr,
        message: '週間ランキングデータがありません',
        data: []
      });
    }
    
    // ユーザー情報を取得
    const userIds = aggregatedRankings.map(r => r._id);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    
    // ユーザー情報をランキングデータと結合
    const formattedRankings = aggregatedRankings.map((record, index) => {
      const user = users.find(u => u._id.toString() === record._id.toString());
      return {
        rank: index + 1,
        userId: record._id,
        username: user ? user.username : 'Unknown User',
        avatar: user ? user.avatar : '😶',
        grade: user ? user.grade : '不明',
        difficulty: record.difficulty,
        score: record.score,
        timeSpent: record.timeSpent,
        totalTime: record.totalTime,
        correctAnswers: record.correctAnswers,
        totalProblems: record.totalProblems,
        streak: user ? user.streak : 0,
        date: record.date
      };
    });
    
    res.json({
      success: true,
      startDate: startDateStr,
      endDate: endDateStr,
      count: formattedRankings.length,
      data: formattedRankings
    });
  } catch (error) {
    console.error("Error in getWeeklyRankings:", error);
    res.status(500).json({ 
      success: false,
      message: '週間ランキングの取得に失敗しました' 
    });
  }
};

// @desc    月間ランキングの取得
// @route   GET /api/rankings/monthly
// @access  Public
export const getMonthlyRankings = async (req, res) => {
  try {
    // 月の始まり（1日の0時）を計算
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const startDateStr = startOfMonth.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];
    
    console.log(`[Ranking] 月間ランキング取得: ${startDateStr} - ${endDateStr}`);
    
    // 難易度フィルタリング
    const matchConditions = {
      date: { 
        $gte: startDateStr,
        $lte: endDateStr
      }
    };
    if (req.query.difficulty) {
      matchConditions.difficulty = req.query.difficulty;
    }
    
    // 各ユーザーごとに最高スコアを集計
    const aggregatedRankings = await Result.aggregate([
      { $match: matchConditions },
      { $sort: { score: -1, timeSpent: 1 } },
      {
        $group: {
          _id: '$userId',
          score: { $max: '$score' },
          timeSpent: { $first: '$timeSpent' },
          totalTime: { $first: '$totalTime' },
          correctAnswers: { $first: '$correctAnswers' },
          totalProblems: { $first: '$totalProblems' },
          difficulty: { $first: '$difficulty' },
          date: { $first: '$date' }
        }
      },
      { $sort: { score: -1, timeSpent: 1 } },
      { $limit: parseInt(req.query.limit) || 50 }
    ]);
    
    if (!aggregatedRankings.length) {
      return res.json({
        success: true,
        month: `${today.getFullYear()}年${today.getMonth() + 1}月`,
        message: '月間ランキングデータがありません',
        data: []
      });
    }
    
    // ユーザー情報を取得
    const userIds = aggregatedRankings.map(r => r._id);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    
    // ユーザー情報をランキングデータと結合
    const formattedRankings = aggregatedRankings.map((record, index) => {
      const user = users.find(u => u._id.toString() === record._id.toString());
      return {
        rank: index + 1,
        userId: record._id,
        username: user ? user.username : 'Unknown User',
        avatar: user ? user.avatar : '😶',
        grade: user ? user.grade : '不明',
        difficulty: record.difficulty,
        score: record.score,
        timeSpent: record.timeSpent,
        totalTime: record.totalTime,
        correctAnswers: record.correctAnswers,
        totalProblems: record.totalProblems,
        streak: user ? user.streak : 0,
        date: record.date
      };
    });
    
    const monthName = today.toLocaleString('ja-JP', { month: 'long' });
    
    res.json({
      success: true,
      month: `${today.getFullYear()}年${monthName}`,
      count: formattedRankings.length,
      data: formattedRankings
    });
  } catch (error) {
    console.error("Error in getMonthlyRankings:", error);
    res.status(500).json({ 
      success: false,
      message: '月間ランキングの取得に失敗しました' 
    });
  }
};

// @desc    ユーザーのランキング取得
// @route   GET /api/rankings/me
// @access  Private
export const getUserRanking = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: '認証が必要です' 
      });
    }
    
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const difficulty = req.query.difficulty;
    
    // 検索条件
    const baseConditions = { date: targetDate };
    if (difficulty) {
      baseConditions.difficulty = difficulty;
    }
    
    // ユーザーの結果を取得
    const userResult = await Result.findOne({
      ...baseConditions,
      userId: userId
    });
    
    if (!userResult) {
      return res.json({
        success: true,
        rank: null,
        message: '該当するデータがありません'
      });
    }
    
    // 同条件でより良いスコアのユーザー数を数える
    const betterScoreCount = await Result.countDocuments({
      ...baseConditions,
      $or: [
        { score: { $gt: userResult.score } },
        { 
          score: userResult.score,
          timeSpent: { $lt: userResult.timeSpent }
        },
        {
          score: userResult.score,
          timeSpent: userResult.timeSpent,
          createdAt: { $lt: userResult.createdAt }
        }
      ]
    });
    
    const rank = betterScoreCount + 1;
    
    res.json({
      success: true,
      rank: rank,
      score: userResult.score,
      timeSpent: userResult.timeSpent,
      date: targetDate,
      difficulty: difficulty || 'all'
    });
  } catch (error) {
    console.error("Error in getUserRanking:", error);
    res.status(500).json({ 
      success: false,
      message: 'ランキング取得に失敗しました' 
    });
  }
};
