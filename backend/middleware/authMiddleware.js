const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * ユーザー認証を確認するミドルウェア
 */
exports.protect = async (req, res, next) => {
  let token;
  
  // Authorization ヘッダーからトークンを取得
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // クッキーからトークンを取得（将来的な拡張用）
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // トークンがない場合はエラー
  if (!token) {
    return res.status(401).json({
      success: false,
      error: '認証されていません。ログインしてください。'
    });
  }
  
  try {
    // トークンを検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // デコードされたIDからユーザーを取得
    req.user = await User.findById(decoded.id);
    
    // ユーザーが存在しない場合
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'このトークンに関連するユーザーが見つかりません'
      });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '認証に失敗しました。もう一度ログインしてください。'
    });
  }
};

/**
 * 時間制限を確認するミドルウェア（6:30-8:00の間のみアクセス可能）
 */
exports.checkTimeWindow = (req, res, next) => {
  // 開発環境ではスキップ可能
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_TIME_CHECK === 'true') {
    return next();
  }
  
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hour + minutes/60;
  
  // 6:30-8:00の間かチェック
  if (currentTime >= 6.5 && currentTime <= 8.0) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: '問題挑戦は朝6:30〜8:00の間のみ可能です。また明日挑戦してください！'
  });
};

/**
 * 特定のロールを持つユーザーのみアクセスを許可する
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `${roles.join(', ')}のロールを持つユーザーのみアクセスできます`
      });
    }
    next();
  };
};