// 🏆 ランキングAPI - Vercel対応
const { ObjectId } = require('mongodb');
const { getGradeLabel, normalizeGrade } = require('./_lib/gradeMapping');
const { getDatabase, handleDatabaseError } = require('./_lib/database');

const IS_PRODUCTION = process.env.VERCEL || process.env.NODE_ENV === 'production';
const logger = {
  info: (...args) => !IS_PRODUCTION && console.log(...args),
  debug: (...args) => !IS_PRODUCTION && console.debug(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const db = await getDatabase();
    const resultsCollection = db.collection('results');
    const usersCollection = db.collection('users');

    // クエリパラメータから difficulty と limit を取得
    const { difficulty, limit = 100, date } = req.query || {};

    // 日付フィルタ（YYYY-MM-DD文字列として扱う）
    let queryDate;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      queryDate = date;
    } else {
      // デフォルトは今日の日付
      const today = new Date();
      queryDate = today.toISOString().split('T')[0]; // YYYY-MM-DD形式
    }

    logger.debug('📊 ランキング取得中...', { queryDate, difficulty });

    // Mongo クエリ条件（文字列として日付を検索）
    const query = {
      date: queryDate
    };

    if (difficulty && typeof difficulty === 'string') {
      query.difficulty = difficulty.toLowerCase();
    }

    // 今日の結果を取得（文字列日付で検索）
    let todayResults = await resultsCollection.find(query)
      .sort({ score: -1, timeSpent: 1, createdAt: 1 })
      .limit(parseInt(limit, 10) || 100)
      .toArray();

    // ★ 文字列日付で結果が見つからない場合、createdAt による日付範囲検索も試行
    if (todayResults.length === 0) {
      logger.debug('⚠️ 文字列日付での結果が見つからないため、createdAt範囲検索を試行');
      const startDate = new Date(queryDate + 'T00:00:00');
      const endDate = new Date(queryDate + 'T23:59:59');
      
      const createdAtQuery = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      if (difficulty && typeof difficulty === 'string') {
        createdAtQuery.difficulty = difficulty.toLowerCase();
      }
      
      todayResults = await resultsCollection.find(createdAtQuery)
        .sort({ score: -1, timeSpent: 1, createdAt: 1 })
        .limit(parseInt(limit, 10) || 100)
        .toArray();
        
      logger.debug('📊 createdAt範囲検索での結果数:', todayResults.length);
    }

    logger.debug('📊 取得した結果数:', todayResults.length);

    if (todayResults.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: '今日のランキングデータがありません'
      });
    }

    // ユーザー情報を取得
    const userIds = todayResults.map(result => {
      try {
        return ObjectId.isValid(result.userId) ? new ObjectId(result.userId) : null;
      } catch (error) {
        logger.warn('⚠️ ObjectId変換エラー:', result.userId);
        return null;
      }
    }).filter(Boolean);

    const users = await usersCollection.find({
      _id: { $in: userIds }
    }).toArray();

    // ユーザー情報をマップに変換
    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = user;
    });

    // ランキングデータの整形
    const rankings = todayResults.map((result, index) => {
      const user = userMap[result.userId?.toString()];
      const username = user?.username ?? result.username ?? 'unknown';
      const gradeNum = user?.grade ?? result.grade;
      const gradeLabel = getGradeLabel(gradeNum);
      
      return {
        rank: index + 1, // rank 再計算
        userId: result.userId,
        username: username,
        avatar: user?.avatar || '👤',
        grade: gradeLabel,
        gradeNum: normalizeGrade(gradeNum), // 元の数値も保持
        score: result.score,
        timeSpent: result.timeSpent, // 0.01秒単位でそのまま表示
        difficulty: result.difficulty,
        date: result.date,
        createdAt: result.createdAt, // 日時列表示用
        correctAnswers: result.correctAnswers || 0,
        totalProblems: result.totalProblems || 10
      };
    });

    return res.status(200).json({
      success: true,
      count: rankings.length,
      data: rankings,
      message: `今日のランキング (${rankings.length}件)`
    });

  } catch (error) {
    const errorResponse = handleDatabaseError(error, 'ランキング取得');
    return res.status(500).json(errorResponse);
  }
}; 