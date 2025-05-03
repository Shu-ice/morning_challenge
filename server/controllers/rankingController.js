const Record = require('../models/recordModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');

// @desc    日間ランキングの取得
// @route   GET /api/rankings/daily
// @access  Public
exports.getDailyRankings = async (req, res) => {
  try {
    // 日付の範囲設定（今日の0時から現在まで）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // グレードフィルタリング
    const gradeFilter = {};
    if (req.query.grade) {
      gradeFilter.grade = parseInt(req.query.grade);
    }
    
    // ランキングの取得（最大50件）
    const rankings = await Record.find({
      date: { $gte: today },
      daily: true,
      ...gradeFilter
    })
    .sort({ score: -1, timeSpent: 1 })
    .limit(50)
    .populate('user', 'username avatar grade streak')
    .lean();
    
    if (!rankings.length) {
      return res.json({
        date: today.toISOString().split('T')[0],
        message: 'まだランキングデータがありません',
        rankings: []
      });
    }
    
    // ランキングデータの整形
    const formattedRankings = rankings.map((record, index) => ({
      rank: index + 1,
      userId: record.user._id,
      username: record.user.username,
      avatar: record.user.avatar,
      grade: record.user.grade,
      score: record.score,
      timeSpent: record.timeSpent,
      correctAnswers: record.correctAnswers,
      streak: record.user.streak,
      date: record.date
    }));
    
    res.json({
      date: today.toISOString().split('T')[0],
      rankings: formattedRankings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    週間ランキングの取得
// @route   GET /api/rankings/weekly
// @access  Public
exports.getWeeklyRankings = async (req, res) => {
  try {
    // 週の始まり（日曜日の0時）を計算
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0が日曜日
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // グレードフィルタリング
    const gradeFilter = {};
    if (req.query.grade) {
      gradeFilter.grade = parseInt(req.query.grade);
    }
    
    // 各ユーザーごとに最高スコアを集計
    const aggregatedRankings = await Record.aggregate([
      { 
        $match: { 
          date: { $gte: startOfWeek },
          weekly: true,
          ...gradeFilter
        } 
      },
      { 
        $sort: { score: -1, timeSpent: 1 } 
      },
      {
        $group: {
          _id: '$user',
          score: { $max: '$score' },
          timeSpent: { $first: '$timeSpent' },
          correctAnswers: { $first: '$correctAnswers' },
          grade: { $first: '$grade' },
          date: { $first: '$date' }
        }
      },
      { $sort: { score: -1, timeSpent: 1 } },
      { $limit: 50 }
    ]);
    
    if (!aggregatedRankings.length) {
      return res.json({
        startDate: startOfWeek.toISOString().split('T')[0],
        message: 'まだランキングデータがありません',
        rankings: []
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
        grade: record.grade,
        score: record.score,
        timeSpent: record.timeSpent,
        correctAnswers: record.correctAnswers,
        streak: user ? user.streak : 0,
        date: record.date
      };
    });
    
    res.json({
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      rankings: formattedRankings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    月間ランキングの取得
// @route   GET /api/rankings/monthly
// @access  Public
exports.getMonthlyRankings = async (req, res) => {
  try {
    // 月の始まり（1日の0時）を計算
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // グレードフィルタリング
    const gradeFilter = {};
    if (req.query.grade) {
      gradeFilter.grade = parseInt(req.query.grade);
    }
    
    // 各ユーザーごとに最高スコアを集計
    const aggregatedRankings = await Record.aggregate([
      { 
        $match: { 
          date: { $gte: startOfMonth },
          monthly: true,
          ...gradeFilter
        } 
      },
      { 
        $sort: { score: -1, timeSpent: 1 } 
      },
      {
        $group: {
          _id: '$user',
          score: { $max: '$score' },
          timeSpent: { $first: '$timeSpent' },
          correctAnswers: { $first: '$correctAnswers' },
          grade: { $first: '$grade' },
          date: { $first: '$date' }
        }
      },
      { $sort: { score: -1, timeSpent: 1 } },
      { $limit: 50 }
    ]);
    
    if (!aggregatedRankings.length) {
      return res.json({
        month: `${today.getFullYear()}/${today.getMonth() + 1}`,
        message: 'まだランキングデータがありません',
        rankings: []
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
        grade: record.grade,
        score: record.score,
        timeSpent: record.timeSpent,
        correctAnswers: record.correctAnswers,
        streak: user ? user.streak : 0,
        date: record.date
      };
    });
    
    const monthName = today.toLocaleString('ja-JP', { month: 'long' });
    
    res.json({
      month: `${today.getFullYear()}年${monthName}`,
      rankings: formattedRankings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    ユーザーのランキング取得
// @route   GET /api/rankings/me
// @access  Private
exports.getUserRanking = async (req, res) => {
  try {
    // 日付の範囲設定
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // 今日のランキング
    const dailyRank = await Record.countDocuments({
      date: { $gte: today },
      score: { $gt: (req.query.score ? parseInt(req.query.score) : 0) }
    }) + 1;
    
    // 週間ランキング
    const weeklyRank = await Record.aggregate([
      { 
        $match: { 
          date: { $gte: startOfWeek },
          weekly: true
        } 
      },
      {
        $group: {
          _id: '$user',
          score: { $max: '$score' }
        }
      },
      { 
        $match: { 
          score: { $gt: (req.query.score ? parseInt(req.query.score) : 0) } 
        } 
      },
      { 
        $count: 'count' 
      }
    ]);
    
    // 月間ランキング
    const monthlyRank = await Record.aggregate([
      { 
        $match: { 
          date: { $gte: startOfMonth },
          monthly: true
        } 
      },
      {
        $group: {
          _id: '$user',
          score: { $max: '$score' }
        }
      },
      { 
        $match: { 
          score: { $gt: (req.query.score ? parseInt(req.query.score) : 0) } 
        } 
      },
      { 
        $count: 'count' 
      }
    ]);
    
    res.json({
      dailyRank,
      weeklyRank: weeklyRank.length > 0 ? weeklyRank[0].count + 1 : 1,
      monthlyRank: monthlyRank.length > 0 ? monthlyRank[0].count + 1 : 1
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
