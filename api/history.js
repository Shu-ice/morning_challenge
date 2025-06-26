// 📜 履歴API - Vercel対応
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// 連続日数計算関数
function calculateStreaks(history) {
  if (history.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }
  
  // 日付でグループ化（重複除去）
  const uniqueDates = [...new Set(history.map(h => h.date))].sort((a, b) => b.localeCompare(a));
  
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  
  // 今日の日付（JST）
  const today = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10);
  
  // 現在の連続日数を計算
  let expectedDate = new Date(today);
  for (const dateStr of uniqueDates) {
    const dateToCheck = expectedDate.toISOString().slice(0,10);
    
    if (dateStr === dateToCheck) {
      currentStreak++;
      // 翌日を期待日に設定
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break; // 連続が終了
    }
  }
  
  // 最大連続日数を計算
  for (let i = 0; i < uniqueDates.length; i++) {
    tempStreak = 1;
    
    for (let j = i + 1; j < uniqueDates.length; j++) {
      const currentDate = new Date(uniqueDates[j-1]);
      const nextDate = new Date(uniqueDates[j]);
      const dayDiff = Math.round((currentDate - nextDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        break;
      }
    }
    
    maxStreak = Math.max(maxStreak, tempStreak);
  }
  
  return { currentStreak, maxStreak };
}

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
    }).sort({ createdAt: -1, date: -1 }).limit(50).toArray();

    console.log('📜 取得した履歴数:', userHistory.length);

    if (userHistory.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: '履歴データがありません'
      });
    }

    // ユニークな (date,difficulty) 組み合わせを抽出し、各組み合わせでランキングを取得して順位マップを作成
    const rankLookup = {};
    const uniqueKeys = [...new Set(userHistory.map(r => `${r.date}__${r.difficulty}`))];
    for (const key of uniqueKeys) {
      const [d, diff] = key.split('__');
      const rankingDocs = await resultsCollection.find({ date: d, difficulty: diff })
        .sort({ score: -1, timeSpent: 1, createdAt: 1 })
        .project({ _id: 1 })
        .toArray();
      rankingDocs.forEach((doc, idx) => {
        rankLookup[doc._id.toString()] = idx + 1;
      });
    }

    // 連続日数を計算
    const { currentStreak, maxStreak } = calculateStreaks(userHistory);
    
    // 履歴データの整形
    const formattedHistory = userHistory.map((result, index) => ({
      id: result._id,
      date: result.date,
      difficulty: result.difficulty,
      score: result.score,
      timeSpent: result.timeSpent,
      totalTime: result.totalTime, // ★ totalTimeも含める
      correctAnswers: result.correctAnswers || 0,
      totalProblems: result.totalProblems || 10,
      accuracy: result.correctAnswers ? 
        Math.round((result.correctAnswers / (result.totalProblems || 10)) * 100) : 0,
      rank: rankLookup[result._id.toString()] || null,
      createdAt: result.createdAt, // ★ createdAtを含める
      timestamp: result.createdAt || result.timestamp // ★ フォールバック用
    }));

    return res.status(200).json({
      success: true,
      count: formattedHistory.length,
      data: formattedHistory,
      currentStreak: currentStreak, // ★ 現在の連続日数
      maxStreak: maxStreak, // ★ 最大連続日数
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

// JST 今日の日付を YYYY-MM-DD で取得
function queryDateToday() {
  return new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10);
} 