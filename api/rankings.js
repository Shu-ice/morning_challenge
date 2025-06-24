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

    console.log('📊 ランキング取得中...', { queryDate, difficulty });

    // Mongo クエリ条件（文字列として日付を検索）
    const query = {
      date: queryDate
    };

    if (difficulty && typeof difficulty === 'string') {
      query.difficulty = difficulty.toLowerCase();
    }

    // 今日の結果を取得（文字列日付で検索）
    let todayResults = await resultsCollection.find(query)
      .sort({ score: -1, timeSpent: 1 })
      .limit(parseInt(limit, 10) || 100)
      .toArray();

    // ★ 文字列日付で結果が見つからない場合、Date型での検索も試行（後方互換性）
    if (todayResults.length === 0) {
      console.log('⚠️ 文字列日付での結果が見つからないため、Date型でも検索を試行');
      const startDate = new Date(queryDate + 'T00:00:00');
      const endDate = new Date(queryDate + 'T00:00:00');
      endDate.setDate(endDate.getDate() + 1);
      
      const dateQuery = {
        date: {
          $gte: startDate,
          $lt: endDate
        }
      };
      
      if (difficulty && typeof difficulty === 'string') {
        dateQuery.difficulty = difficulty.toLowerCase();
      }
      
      todayResults = await resultsCollection.find(dateQuery)
        .sort({ score: -1, timeSpent: 1 })
        .limit(parseInt(limit, 10) || 100)
        .toArray();
        
      console.log('📊 Date型検索での結果数:', todayResults.length);
    }

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
      const username = user?.username || result.username || '不明なユーザー';
      const rawGrade = user?.grade ?? result.grade;
      const gradeDisplay = (rawGrade === 99 || rawGrade === 999) ? 'ひみつ' : (rawGrade || 1);
      return {
        rank: index + 1,
        userId: result.userId,
        username: username,
        avatar: user?.avatar || '👤',
        grade: gradeDisplay,
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