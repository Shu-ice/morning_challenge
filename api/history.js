// 📜 履歴API - Vercel対応
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

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

  // JWT認証
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  let userId;
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    userId = decoded.userId;
    console.log('👤 履歴取得ユーザー:', userId);
  } catch (error) {
    console.error('❌ JWT検証エラー:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }

  let client;

  try {
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db('morning_challenge');
    const resultsCollection = db.collection('results');

    console.log('📜 履歴データ検索中...', { userId });

    // ユーザーの履歴を取得（新しい順）
    const userHistory = await resultsCollection.find({
      userId: userId
    }).sort({ date: -1 }).limit(50).toArray();

    console.log('📜 取得した履歴数:', userHistory.length);

    if (userHistory.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: '履歴データがありません'
      });
    }

    // 履歴データの整形
    const formattedHistory = userHistory.map((result, index) => ({
      id: result._id,
      date: result.date,
      difficulty: result.difficulty,
      score: result.score,
      timeSpent: result.timeSpent,
      correctAnswers: result.correctAnswers || 0,
      totalProblems: result.totalProblems || 10,
      accuracy: result.correctAnswers ? 
        Math.round((result.correctAnswers / (result.totalProblems || 10)) * 100) : 0,
      rank: index + 1
    }));

    return res.status(200).json({
      success: true,
      count: formattedHistory.length,
      data: formattedHistory,
      message: `履歴データ (${formattedHistory.length}件)`
    });

  } catch (error) {
    console.error('❌ 履歴取得エラー:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '履歴の取得に失敗しました'
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 