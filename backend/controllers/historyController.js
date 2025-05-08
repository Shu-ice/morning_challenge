import History from '../models/History.js';
import User from '../models/User.js';

/**
 * @desc    ユーザーの解答履歴を取得
 * @route   GET /api/history
 * @access  Private
 */
export const getUserHistory = async (req, res) => {
  try {
    // req.user.idではなくreq.user._idを使用（認証ミドルウェアの標準形式に合わせる）
    const userId = req.user._id || req.user.id; 
    
    // ページネーションのためのクエリパラメータを取得 (デフォルト値設定)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10; // 1ページあたり10件
    const skip = (page - 1) * limit;
    
    // ユーザー情報を取得してストリーク情報を取得
    const user = await User.findById(userId).select('streak');
    
    // ユーザーの履歴を新しい順に取得
    // もしIDでの検索に失敗した場合のバックアップとしてusernameも試す
    let history = await History.find({ user: userId })
      .sort({ timestamp: -1 }) // 新しい順
      .skip(skip)
      .limit(limit)
      .lean(); // lean()で Mongoose Document ではなく Plain JavaScript Object を取得
      
    // IDでの検索が結果を返さなかった場合、usernameで検索を試みる
    if (history.length === 0 && req.user.username) {
      const userName = req.user.username;
      // ユーザー名でも検索を試みる（移行期用）
      history = await History.find({ username: userName })
        .sort({ timestamp: -1 }) 
        .skip(skip)
        .limit(limit)
        .lean();
    }
      
    // 総履歴数を取得 (ページネーション用)
    const totalHistory = await History.countDocuments({ user: userId });
    
    // レスポンスの整形 (必要に応じて)
    const formattedHistory = history.map(item => ({
      id: item._id,
      difficulty: item.difficulty,
      grade: item.grade,
      totalProblems: item.totalProblems,
      correctAnswers: item.correctAnswers,
      score: item.score,
      timeSpent: item.timeSpent,
      timestamp: item.timestamp
      // 問題詳細はデータ量が多いので、ここでは返さない。詳細APIを別途作ることも可能
    }));
    
    res.status(200).json({
      success: true,
      count: formattedHistory.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalHistory / limit),
        totalItems: totalHistory
      },
      data: formattedHistory,
      streak: user ? user.streak : 0
    });

  } catch (error) {
    console.error('履歴取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '履歴の取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    履歴の詳細を取得
 * @route   GET /api/history/:id
 * @access  Private
 */
export const getHistoryDetail = async (req, res) => {
  try {
    const historyId = req.params.id;
    const userId = req.user._id || req.user.id;
    
    // IDに基づいて履歴を取得し、所有者を確認
    const history = await History.findOne({ 
      _id: historyId,
      user: userId
    }).lean();
    
    // IDで見つからない場合、usernameでも検索を試みる（移行期用）
    if (!history && req.user.username) {
      const username = req.user.username;
      const historyByUsername = await History.findOne({
        _id: historyId,
        username: username
      }).lean();
      
      if (historyByUsername) {
        return res.status(200).json({
          success: true,
          data: historyByUsername
        });
      }
    }
    
    if (!history) {
      return res.status(404).json({ 
        success: false,
        error: '指定された履歴が見つからないか、アクセス権がありません'
      });
    }
    
    res.status(200).json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('履歴詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '履歴詳細の取得中にエラーが発生しました'
    });
  }
}; 