const Result = require('../models/Result');
const User = require('../models/User');

/**
 * @desc    全期間のランキングを取得
 * @route   GET /api/rankings
 * @access  Private (auth)
 */
exports.getAllRankings = async (req, res) => {
  try {
    const { grade } = req.query;
    
    // クエリ条件
    const query = {};
    
    // 学年フィルター（もし指定されていれば）
    if (grade && !isNaN(parseInt(grade))) {
      query.grade = parseInt(grade);
    }
    
    // 各ユーザーの合計スコアを集計
    const aggregatedResults = await Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$user',
          totalScore: { $sum: '$score' },
          count: { $sum: 1 },
          bestResult: { $first: '$$ROOT' }
        }
      },
      { $sort: { totalScore: -1, count: -1 } },
      { $limit: 50 }
    ]);
    
    // ユーザー情報を取得
    const userIds = aggregatedResults.map(result => result._id);
    const users = await User.find({ _id: { $in: userIds } });
    
    // 結果を整形
    const formattedRankings = aggregatedResults.map((result, index) => {
      const user = users.find(u => u._id.toString() === result._id.toString());
      return {
        rank: index + 1,
        id: result._id,
        user: user ? {
          id: user._id,
          username: user.username,
          avatar: user.avatar,
          grade: user.grade,
          streak: user.streak
        } : null,
        totalScore: result.totalScore,
        count: result.count
      };
    });
    
    res.status(200).json({
      success: true,
      count: formattedRankings.length,
      data: formattedRankings
    });
  } catch (error) {
    console.error('全体ランキング取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'ランキングの取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    日間ランキングを取得
 * @route   GET /api/rankings/daily
 * @access  Public
 */
exports.getDailyRanking = async (req, res) => {
  try {
    const { grade } = req.query;
    
    // 今日の日付範囲
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // クエリ条件
    const query = {
      date: { $gte: today, $lt: tomorrow }
    };
    
    // 学年フィルター（もし指定されていれば）
    if (grade && !isNaN(parseInt(grade))) {
      query.grade = parseInt(grade);
    }
    
    // スコア順にランキングを取得
    const rankings = await Result.find(query)
      .sort({ score: -1, totalTime: 1 })
      .limit(50)
      .populate('user', 'username avatar grade streak');
    
    // レスポンス用にデータを整形
    const formattedRankings = rankings.map((result, index) => ({
      rank: index + 1,
      id: result._id,
      user: {
        id: result.user._id,
        username: result.user.username,
        avatar: result.user.avatar,
        grade: result.user.grade,
        streak: result.user.streak
      },
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalProblems: result.totalProblems,
      totalTime: result.totalTime,
      date: result.date
    }));
    
    // 認証済みユーザーの場合、自分の順位も取得
    let userRanking = null;
    if (req.user) {
      const userResult = await Result.findOne({
        ...query,
        user: req.user.id
      }).sort({ score: -1, totalTime: 1 });
      
      if (userResult) {
        // 自分より上位のスコアの数を数える
        const higherScoresCount = await Result.countDocuments({
          ...query,
          $or: [
            { score: { $gt: userResult.score } },
            { 
              score: userResult.score,
              totalTime: { $lt: userResult.totalTime }
            }
          ]
        });
        
        userRanking = {
          rank: higherScoresCount + 1,
          id: userResult._id,
          score: userResult.score,
          correctAnswers: userResult.correctAnswers,
          totalProblems: userResult.totalProblems,
          totalTime: userResult.totalTime,
          date: userResult.date
        };
      }
    }
    
    res.status(200).json({
      success: true,
      count: formattedRankings.length,
      userRanking,
      data: formattedRankings
    });
  } catch (error) {
    console.error('日間ランキング取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '日間ランキングの取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    週間ランキングを取得
 * @route   GET /api/rankings/weekly
 * @access  Public
 */
exports.getWeeklyRanking = async (req, res) => {
  try {
    const { grade } = req.query;
    
    // 週初め（月曜日）の計算
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // 日曜が0なので7に変換
    const diff = dayOfWeek - 1; // 月曜日からの差分
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    
    // クエリ条件
    const query = {
      date: { $gte: weekStart, $lt: weekEnd }
    };
    
    // 学年フィルター
    if (grade && !isNaN(parseInt(grade))) {
      query.grade = parseInt(grade);
    }
    
    // 各ユーザーの最高スコアを集計（MongoDBのアグリゲーション）
    const aggregatedResults = await Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$user',
          bestScore: { $max: '$score' },
          bestResult: { $first: '$$ROOT' }
        }
      },
      { $sort: { bestScore: -1, 'bestResult.totalTime': 1 } },
      { $limit: 50 }
    ]);
    
    // ユーザー情報を取得
    const userIds = aggregatedResults.map(result => result._id);
    const users = await User.find({ _id: { $in: userIds } });
    
    // 結果を整形
    const formattedRankings = aggregatedResults.map((result, index) => {
      const user = users.find(u => u._id.toString() === result._id.toString());
      return {
        rank: index + 1,
        id: result.bestResult._id,
        user: user ? {
          id: user._id,
          username: user.username,
          avatar: user.avatar,
          grade: user.grade,
          streak: user.streak
        } : null,
        score: result.bestScore,
        totalTime: result.bestResult.totalTime,
        date: result.bestResult.date
      };
    });
    
    // 認証済みユーザーの場合、自分の順位も取得
    let userRanking = null;
    if (req.user) {
      // ユーザーの最高スコアを取得
      const userBestResult = await Result.findOne({
        ...query,
        user: req.user.id
      }).sort({ score: -1, totalTime: 1 });
      
      if (userBestResult) {
        // 集計からユーザーの順位を計算
        const userRankData = aggregatedResults.findIndex(
          result => result._id.toString() === req.user.id
        );
        
        userRanking = {
          rank: userRankData !== -1 ? userRankData + 1 : null,
          id: userBestResult._id,
          score: userBestResult.score,
          totalTime: userBestResult.totalTime,
          date: userBestResult.date
        };
      }
    }
    
    res.status(200).json({
      success: true,
      count: formattedRankings.length,
      userRanking,
      data: formattedRankings
    });
  } catch (error) {
    console.error('週間ランキング取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '週間ランキングの取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    月間ランキングを取得
 * @route   GET /api/rankings/monthly
 * @access  Public
 */
exports.getMonthlyRanking = async (req, res) => {
  try {
    const { grade } = req.query;
    
    // 月初めの計算
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    // クエリ条件
    const query = {
      date: { $gte: monthStart, $lte: monthEnd }
    };
    
    // 学年フィルター
    if (grade && !isNaN(parseInt(grade))) {
      query.grade = parseInt(grade);
    }
    
    // 各ユーザーの最高スコアを集計
    const aggregatedResults = await Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$user',
          bestScore: { $max: '$score' },
          totalScore: { $sum: '$score' },
          count: { $sum: 1 },
          bestResult: { $first: '$$ROOT' }
        }
      },
      { $sort: { totalScore: -1, count: -1 } },
      { $limit: 50 }
    ]);
    
    // ユーザー情報を取得
    const userIds = aggregatedResults.map(result => result._id);
    const users = await User.find({ _id: { $in: userIds } });
    
    // 結果を整形（月間は合計スコアが基準）
    const formattedRankings = aggregatedResults.map((result, index) => {
      const user = users.find(u => u._id.toString() === result._id.toString());
      return {
        rank: index + 1,
        id: result.bestResult._id,
        user: user ? {
          id: user._id,
          username: user.username,
          avatar: user.avatar,
          grade: user.grade,
          streak: user.streak
        } : null,
        totalScore: result.totalScore,
        bestScore: result.bestScore,
        count: result.count,
        date: monthStart // 月の表示用
      };
    });
    
    // 認証済みユーザーの場合、自分の順位も取得
    let userRanking = null;
    if (req.user) {
      // ユーザーの結果を集計
      const userResults = await Result.find({
        ...query,
        user: req.user.id
      });
      
      if (userResults.length > 0) {
        const totalScore = userResults.reduce((sum, result) => sum + result.score, 0);
        const bestScore = Math.max(...userResults.map(result => result.score));
        
        // 自分より上位の集計結果の数を数える
        const userRankIndex = aggregatedResults.findIndex(
          result => result._id.toString() === req.user.id
        );
        
        userRanking = {
          rank: userRankIndex !== -1 ? userRankIndex + 1 : null,
          totalScore,
          bestScore,
          count: userResults.length
        };
      }
    }
    
    res.status(200).json({
      success: true,
      count: formattedRankings.length,
      userRanking,
      data: formattedRankings
    });
  } catch (error) {
    console.error('月間ランキング取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '月間ランキングの取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    学年別ランキングを取得
 * @route   GET /api/rankings/grade/:grade
 * @access  Private (auth)
 */
exports.getGradeRanking = async (req, res) => {
  try {
    const grade = parseInt(req.params.grade);
    
    if (isNaN(grade) || grade < 1 || grade > 6) {
      return res.status(400).json({
        success: false,
        error: '有効な学年(1-6)を指定してください'
      });
    }
    
    // 指定された学年のすべての結果を取得
    const aggregatedResults = await Result.aggregate([
      { $match: { grade } },
      {
        $group: {
          _id: '$user',
          totalScore: { $sum: '$score' },
          count: { $sum: 1 },
          bestResult: { $first: '$$ROOT' }
        }
      },
      { $sort: { totalScore: -1, count: -1 } },
      { $limit: 50 }
    ]);
    
    // ユーザー情報を取得
    const userIds = aggregatedResults.map(result => result._id);
    const users = await User.find({ _id: { $in: userIds } });
    
    // 結果を整形
    const formattedRankings = aggregatedResults.map((result, index) => {
      const user = users.find(u => u._id.toString() === result._id.toString());
      return {
        rank: index + 1,
        id: result._id,
        user: user ? {
          id: user._id,
          username: user.username,
          avatar: user.avatar,
          grade: user.grade,
          streak: user.streak
        } : null,
        totalScore: result.totalScore,
        count: result.count
      };
    });
    
    res.status(200).json({
      success: true,
      count: formattedRankings.length,
      data: formattedRankings
    });
  } catch (error) {
    console.error('学年別ランキング取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '学年別ランキングの取得中にエラーが発生しました'
    });
  }
};

// rankingRoutes.jsのインポートに合わせて関数をエクスポート
exports.getDailyRankings = exports.getDailyRanking;
exports.getWeeklyRankings = exports.getWeeklyRanking;
exports.getMonthlyRankings = exports.getMonthlyRanking;
exports.getGradeRankings = exports.getGradeRanking;
exports.getRankings = exports.getAllRankings;