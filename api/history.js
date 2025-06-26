// 📜 履歴API - Vercel対応
// 🚀 最適化版 - MongooseとObjectId/Stringの互換性対応

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectMongoose } = require('./_lib/database');
const { Result, User } = require('./_lib/models');

// 連続日数計算関数
function calculateStreaks(history) {
  if (!history || history.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  const uniqueDates = [...new Set(history.map(h => h.date))].sort((a, b) => b.localeCompare(a));

  let currentStreak = 0;
  let maxStreak = 0;

  // 今日の日付（JST）
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let expectedDate = new Date(today);

  // 現在の連続日数
  if (uniqueDates.length > 0 && uniqueDates[0] === today) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i-1]);
        const previousDate = new Date(uniqueDates[i]);
        const diffDays = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            currentStreak++;
        } else {
            break;
        }
    }
  }

  // 最大連続日数
  if (uniqueDates.length > 0) {
      let tempStreak = 1;
      maxStreak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
          const currentDate = new Date(uniqueDates[i-1]);
          const previousDate = new Date(uniqueDates[i]);
          const diffDays = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
              tempStreak++;
          } else {
              tempStreak = 1;
          }
          maxStreak = Math.max(maxStreak, tempStreak);
      }
  }

  return { currentStreak, maxStreak };
}


module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // JWT認証
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const userId = decoded._id || decoded.id || decoded.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Invalid token: User ID not found' });
    }

    // DB接続
    await connectMongoose();

    // 🚀【重要】ObjectIdと文字列の両方でユーザーを検索
    const userHistory = await Result.find({
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: userId }
      ]
    }).sort({ createdAt: -1 }).limit(100).lean();

    if (userHistory.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        currentStreak: 0,
        maxStreak: 0,
        message: '履歴データがありません'
      });
    }
    
    // ユーザー情報取得
    const user = await User.findById(userId).lean();

    // 連続日数計算
    const { currentStreak, maxStreak } = calculateStreaks(userHistory);

    // 履歴データの整形
    const formattedHistory = userHistory.map(result => ({
      id: result._id.toString(),
      date: result.date,
      difficulty: result.difficulty,
      score: result.score,
      timeSpent: result.timeSpent,
      correctAnswers: result.correctAnswers,
      totalProblems: result.totalProblems,
      // 古いデータは incorrectAnswers がないため、ここで計算
      incorrectAnswers: result.incorrectAnswers ?? (result.totalProblems - result.correctAnswers - (result.unanswered ?? 0)),
      unanswered: result.unanswered ?? (result.totalProblems - result.correctAnswers - (result.incorrectAnswers ?? 0)),
      createdAt: result.createdAt,
      rank: null // ランキング機能は別途実装
    }));

    return res.status(200).json({
      success: true,
      count: formattedHistory.length,
      data: formattedHistory,
      user: {
          username: user?.username,
          avatar: user?.avatar,
          grade: user?.grade
      },
      currentStreak: currentStreak,
      maxStreak: maxStreak,
      message: `履歴データ (${formattedHistory.length}件)`
    });

  } catch (error) {
    console.error('❌ 履歴取得エラー:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '履歴の取得に失敗しました'
    });
  }
};

// JST 今日の日付を YYYY-MM-DD で取得
function queryDateToday() {
  return new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10);
} 