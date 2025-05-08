const Result = require('../models/resultModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');

// @desc    日間ランキングの取得
// @route   GET /api/rankings/daily
// @access  Public
exports.getDailyRankings = async (req, res) => {
  try {
    // 今日の日付を "YYYY-MM-DD" 形式の文字列で取得
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 難易度フィルタリング（例: req.query.difficulty が存在する場合）
    const filterConditions = {
      date: todayStr, // 日付は今日の日付文字列と完全一致
    };
    if (req.query.difficulty) {
      filterConditions.difficulty = req.query.difficulty;
    }
    // もしユーザーの段位(grade)で絞り込みたい場合は、populate後の処理や別途User検索が必要
    // const gradeFilter = {};
    // if (req.query.grade) {
    //   gradeFilter.grade = parseInt(req.query.grade); // Userモデルのgradeを想定
    // }
    
    // ランキングの取得（最大50件）
    const rankings = await Result.find(filterConditions) // RecordからResultに変更、daily: true を削除
    .sort({ score: -1, timeSpent: 1 })
    .limit(50)
    .populate('userId', 'username avatar grade streak') // 'user' から 'userId' に変更
    .lean();
    
    if (!rankings.length) {
      return res.json({
        date: todayStr,
        message: 'まだランキングデータがありません',
        rankings: []
      });
    }
    
    // ランキングデータの整形
    const formattedRankings = rankings.map((result, index) => {
      // populateが成功しているか確認
      if (!result.userId) {
        console.error(`User data not populated for result ID: ${result._id}. Skipping this result.`);
        return null; // populate失敗したデータはスキップ
      }
      return {
        rank: index + 1,
        userId: result.userId._id,
        username: result.userId.username,
        avatar: result.userId.avatar,
        grade: result.userId.grade, // Userモデルのgrade
        difficulty: result.difficulty, // Resultモデルのdifficulty
        score: result.score,
        timeSpent: result.timeSpent,
        correctAnswers: result.correctAnswers,
        incorrectAnswers: result.incorrectAnswers, // 追加
        unanswered: result.unanswered, // 追加
        streak: result.userId.streak, // Userモデルのstreak
        date: result.date
      };
    }).filter(Boolean); // nullを除去
    
    res.json({
      date: todayStr,
      rankings: formattedRankings
    });
  } catch (error) {
    console.error("Error in getDailyRankings:", error); // エラーログを詳細に
    res.status(500).json({ message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
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
    const aggregatedRankings = await Result.aggregate([
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
          _id: '$userId',
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
    const aggregatedRankings = await Result.aggregate([
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
          _id: '$userId',
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
    const dailyRank = await Result.countDocuments({
      date: { $gte: today },
      score: { $gt: (req.query.score ? parseInt(req.query.score) : 0) }
    }) + 1;
    
    // 週間ランキング
    const weeklyRank = await Result.aggregate([
      { 
        $match: { 
          date: { $gte: startOfWeek },
          weekly: true
        } 
      },
      {
        $group: {
          _id: '$userId',
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
    const monthlyRank = await Result.aggregate([
      { 
        $match: { 
          date: { $gte: startOfMonth },
          monthly: true
        } 
      },
      {
        $group: {
          _id: '$userId',
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
