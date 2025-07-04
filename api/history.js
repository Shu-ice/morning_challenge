// 📜 履歴API - Vercel対応
// 🚀 最適化版 - MongooseとObjectId/Stringの互換性対応

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectMongoose } = require('./_lib/database');
const { Result, User, DailyProblemSet } = require('./_lib/models');

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

    // ページングパラメータの取得と検証
    let limit = parseInt(req.query.limit) || 10; // デフォルト10件
    let offset = parseInt(req.query.offset) || 0; // デフォルト0から開始
    const includeSummary = req.query.summary === 'true'; // summaryパラメータの確認
    
    // パラメータの検証
    if (isNaN(limit) || limit < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'limit parameter must be a positive integer' 
      });
    }
    if (limit > 100) {
      limit = 100; // 最大100件に制限
    }
    if (isNaN(offset) || offset < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'offset parameter must be a non-negative integer' 
      });
    }

    // DB接続
    await connectMongoose();

    // ユーザー検索条件
    const userFilter = {
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: userId }
      ]
    };

    // 全件数を取得
    const totalCount = await Result.countDocuments(userFilter);

    // ページング対応で履歴データを取得
    const userHistory = await Result.find(userFilter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    if (userHistory.length === 0 && offset === 0) {
      const response = {
        success: true,
        count: 0,
        totalCount: 0,
        offset: offset,
        limit: limit,
        hasMore: false,
        data: [],
        history: [], // フロントエンド互換性のため
        message: '履歴データがありません'
      };
      
      // summaryパラメータがtrueの場合のみsummary情報を追加
      if (includeSummary) {
        response.summary = {
          currentStreak: 0,
          bestStreak: 0
        };
      }
      
      return res.status(200).json(response);
    }
    
    // offsetが範囲外の場合
    if (userHistory.length === 0 && offset > 0) {
      return res.status(400).json({
        success: false,
        message: `offset ${offset} is out of range. Total records: ${totalCount}`
      });
    }
    
    // ユーザー情報取得
    const user = await User.findById(userId).lean();

    // 連続日数計算（summaryパラメータがtrueの場合のみ実行）
    let streakData = { currentStreak: 0, maxStreak: 0 };
    if (includeSummary && totalCount > 0) {
      // 連続日数計算のために全履歴データの日付のみを取得
      const allHistoryForStreaks = await Result.find(userFilter)
        .select('date createdAt')
        .sort({ createdAt: -1 })
        .lean();
      streakData = calculateStreaks(allHistoryForStreaks);
    }
    const { currentStreak, maxStreak } = streakData;

    // 履歴データの整形
    const formattedHistory = await Promise.all(userHistory.map(async (result) => {
      let rank = null;
      try {
        // 複数の方法で順位を取得する堅牢なロジック
        const searchDate = result.date;
        
        // 1. DailyProblemSetから順位情報を取得
        let dailyProblem = await DailyProblemSet.findOne({ 
          date: searchDate,
          difficulty: result.difficulty 
        }).lean();

        // フォールバック: 日付形式を変換して再検索
        if (!dailyProblem && result.date) {
          const formattedDate = new Date(result.date).toISOString().split('T')[0];
          dailyProblem = await DailyProblemSet.findOne({ 
            date: formattedDate,
            difficulty: result.difficulty 
          }).lean();
        }

        if (dailyProblem && dailyProblem.rankings) {
          const userRanking = dailyProblem.rankings.find(r => 
            r.userId && (
              r.userId.toString() === userId.toString() || 
              r.userId.toString() === result.userId?.toString()
            )
          );
          if (userRanking) {
            rank = userRanking.rank;
          }
        }

        // 2. フォールバック: その日の全結果から動的計算
        if (rank === null) {
          console.log(`[History API] Rank not found in DailyProblemSet for date: ${result.date}, difficulty: ${result.difficulty}. Falling back to dynamic calculation.`);
          const sameDayResults = await Result.find({ 
            date: result.date, 
            difficulty: result.difficulty 
          }).sort({ score: -1, timeSpent: 1 }).lean();
          
          // console.log(`[History API] Found ${sameDayResults.length} results for dynamic ranking.`);
          
          // 修正：userIdではなく、ユニークなresult._idで順位を特定する
          const userIndex = sameDayResults.findIndex(r => r._id.toString() === result._id.toString());
          
          if (userIndex === -1) {
            // このログは通常は出ないはずだが、万が一のために残す
            console.warn(`[History API] Could not find specific result in sameDayResults. ResultID: ${result._id.toString()}`);
          }

          if (userIndex !== -1) {
            rank = userIndex + 1;
            // console.log(`[History API] Dynamic rank calculated: ${rank}`);
          }
        }
      } catch(e) {
        console.error('Rank fetching failed for date:', result.date, e);
      }

      // 修正：表示用のデータを生成する
      const timeInSeconds = result.timeSpent ? (result.timeSpent / 1000).toFixed(2) : '0.00';
      const executionTime = new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      }).format(new Date(result.createdAt)).replace(/\//g, '/');

      return {
        id: result._id.toString(),
        date: result.date,
        difficulty: result.difficulty,
        score: result.score,
        timeSpent: timeInSeconds, // 整形済みの秒
        correctAnswers: result.correctAnswers,
        totalProblems: result.totalProblems,
        incorrectAnswers: result.incorrectAnswers ?? (result.totalProblems - result.correctAnswers),
        unanswered: result.unanswered ?? 0,
        createdAt: result.createdAt, // 元データも残す
        executionTime: executionTime, // 整形済みの「月/日 時:分」
        rank: rank
      };
    }));

    // hasMore計算
    const hasMore = (offset + limit) < totalCount;
    
    // レスポンスオブジェクトの構築
    const response = {
      success: true,
      count: formattedHistory.length,
      totalCount: totalCount,
      offset: offset,
      limit: limit,
      hasMore: hasMore,
      data: formattedHistory,
      history: formattedHistory, // フロントエンド互換性のため
      user: {
          username: user?.username,
          avatar: user?.avatar,
          grade: user?.grade
      },
      message: `履歴データ (${formattedHistory.length}件/${totalCount}件中)`
    };
    
    // summaryパラメータがtrueの場合のみsummary情報を追加
    if (includeSummary) {
      response.summary = {
        currentStreak: currentStreak,
        bestStreak: maxStreak
      };
    }
    
    return res.status(200).json(response);

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