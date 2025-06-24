// 🏆 ランキングAPI - Vercel対応
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng';

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

  let client;

  try {
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db('morning_challenge');
    const resultsCollection = db.collection('results');
    const usersCollection = db.collection('users');

    // 今日のランキング取得（デフォルト）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('📊 ランキング取得中...', { today, tomorrow });

    // クエリパラメータから difficulty と limit を取得
    const { difficulty, limit = 100, date } = req.query || {};

    // 日付フィルタ（YYYY-MM-DD）
    let startDate = today;
    let endDate = tomorrow;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      startDate = new Date(date + 'T00:00:00');
      endDate = new Date(date + 'T00:00:00');
      endDate.setDate(endDate.getDate() + 1);
    }

    // Mongo クエリ条件
    const query = {
      date: {
        $gte: startDate,
        $lt: endDate
      }
    };

    if (difficulty && typeof difficulty === 'string') {
      query.difficulty = difficulty.toLowerCase();
    }

    // 今日の結果を取得
    const todayResults = await resultsCollection.find(query)
      .sort({ score: -1, timeSpent: 1 })
      .limit(parseInt(limit, 10) || 100)
      .toArray();

    console.log('📊 取得した結果数:', todayResults.length);

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
        console.log('⚠️ ObjectId変換エラー:', result.userId);
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
      return {
        rank: index + 1,
        userId: result.userId,
        username: user?.username || '不明なユーザー',
        avatar: user?.avatar || '👤',
        grade: user?.grade || 1,
        score: result.score,
        timeSpent: result.timeSpent,
        difficulty: result.difficulty,
        date: result.date,
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
    console.error('❌ ランキング取得エラー:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'ランキングの取得に失敗しました'
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 