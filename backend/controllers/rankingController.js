import Result from '../models/Result.js';
import User from '../models/User.js';

/**
 * @desc    全期間のランキングを取得
 * @route   GET /api/rankings
 * @access  Private (auth)
 */
export const getAllRankings = async (req, res) => {
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
export const getDailyRanking = async (req, res) => {
  try {
    const { difficulty, date: dateQuery } = req.query;
    console.log(`[Rankings] getDailyRanking: difficulty query = ${difficulty}, date query = ${dateQuery}`);
    
    let targetDateString;
    if (dateQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
      targetDateString = dateQuery;
      console.log(`[Rankings] getDailyRanking: Using date from query = ${targetDateString}`);
    } else {
      const today = new Date();
      targetDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      console.log(`[Rankings] getDailyRanking: Using today date = ${targetDateString}`);
    }
    
    const query = {
      date: targetDateString
    };
    if (difficulty) {
      query.difficulty = difficulty;
    }
    console.log('[Rankings] getDailyRanking: Query conditions =', JSON.stringify(query, null, 2));
    
    const rankingsRaw = await Result.find(query)
      .sort({ score: -1, totalTime: 1 })
      .limit(50);
    console.log('[Rankings] getDailyRanking: Results from DB (before populate) =', JSON.stringify(rankingsRaw, null, 2));

    const rankings = await Result.find(query)
      .sort({ score: -1, totalTime: 1 })
      .limit(50)
      .populate('userId', 'username avatar grade streak');
    console.log('[Rankings] getDailyRanking: Results from DB (after populate) =', JSON.stringify(rankings, null, 2));
    
    const formattedRankings = rankings.map((result, index) => {
      const userPopulated = result.userId && typeof result.userId === 'object';
      
      return {
        rank: index + 1,
        id: result._id,
        user: userPopulated ? {
          id: result.userId._id,
          username: result.userId.username,
          avatar: result.userId.avatar,
          grade: result.userId.grade,
          streak: result.userId.streak
        } : {
          id: null,
          username: '不明なユーザー',
          avatar: '',
          grade: null,
          streak: 0
        },
        correctAnswers: result.correctAnswers,
        totalProblems: result.totalProblems,
        totalTime: result.totalTime,
        date: result.date
      }
    }).filter(r => r.user.id !== null);
    
    let userRanking = null;
    if (req.user) {
      const userResult = await Result.findOne({
        ...query,
        userId: req.user.id
      }).sort({ score: -1, totalTime: 1 });
      
      if (userResult) {
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
    
    const responseData = {
      success: true,
      count: formattedRankings.length,
      userRanking,
      data: formattedRankings
    };
    console.log('[Rankings] getDailyRanking: Final response data =', JSON.stringify(responseData, null, 2));

    res.status(200).json(responseData);
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
export const getWeeklyRanking = async (req, res) => {
  try {
    const { difficulty } = req.query;
    
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; 
    const diff = dayOfWeek - 1; 
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartString = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // 月曜日から6日後が日曜日
    weekEnd.setHours(23, 59, 59, 999); // 日曜日の終わりまで
    const weekEndString = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;
    
    const query = {
      date: { $gte: weekStartString, $lte: weekEndString } // 文字列で範囲比較
    };
    
    if (difficulty) {
      query.difficulty = difficulty;
    }
    
    // 各ユーザーの最高スコアを集計（MongoDBのアグリゲーション）
    const aggregatedResults = await Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$userId',
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
        userId: req.user.id
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
export const getMonthlyRanking = async (req, res) => {
  try {
    const { difficulty } = req.query;
    
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartString = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-${String(monthStart.getDate()).padStart(2, '0')}`;
    
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0); // 月の最終日
    monthEnd.setHours(23, 59, 59, 999);
    const monthEndString = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
    
    const query = {
      date: { $gte: monthStartString, $lte: monthEndString } // 文字列で範囲比較
    };
    
    if (difficulty) {
      query.difficulty = difficulty;
    }
    
    // 各ユーザーの最高スコアを集計
    const aggregatedResults = await Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$userId',
          totalScore: { $sum: '$score' },
          count: { $sum: 1 },
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
        user: user ? {
          id: user._id,
          username: user.username,
          avatar: user.avatar,
          grade: user.grade,
          streak: user.streak
        } : null,
        totalScore: result.totalScore,
        count: result.count,
      };
    });
    
    // 認証済みユーザーの場合、自分の順位も取得
    let userRanking = null;
    if (req.user) {
      // ユーザーの結果を集計
      const userResults = await Result.find({
        ...query,
        userId: req.user.id
      });
      
      if (userResults.length > 0) {
        const totalScore = userResults.reduce((sum, result) => sum + result.score, 0);
        
        // 自分より上位の集計結果の数を数える
        const userRankIndex = aggregatedResults.findIndex(
          result => result._id.toString() === req.user.id
        );
        
        userRanking = {
          rank: userRankIndex !== -1 ? userRankIndex + 1 : null,
          totalScore,
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
export const getGradeRanking = async (req, res) => {
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
export const getDailyRankings = getDailyRanking;
export const getWeeklyRankings = getWeeklyRanking;
export const getMonthlyRankings = getMonthlyRanking;
export const getGradeRankings = getGradeRanking;
export const getRankings = getAllRankings;