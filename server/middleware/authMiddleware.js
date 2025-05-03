const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// ユーザー認証ミドルウェア
const protect = async (req, res, next) => {
  try {
    let token;

    // Authorizationヘッダーからトークンを取得
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // または、クッキーからトークンを取得
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '認証が必要です。ログインしてください。'
      });
    }

    // トークンを検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'morningmathsecret');

    // ユーザー情報を取得
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'ユーザーが存在しません。'
      });
    }

    // リクエストオブジェクトにユーザー情報を追加
    req.user = user;
    next();
  } catch (error) {
    console.error('認証エラー:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '無効なトークンです。再度ログインしてください。'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'トークンの有効期限が切れています。再度ログインしてください。'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。'
    });
  }
};

// 管理者権限チェックミドルウェア
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: '管理者権限が必要です。'
    });
  }
};

// 時間制限チェックミドルウェア
const timeRestriction = (req, res, next) => {
  try {
    // 開発モードでのスキップ設定
    const skipTimeCheck = req.query.skipTimeCheck === 'true';
    
    if (skipTimeCheck) {
      return next();
    }
    
    // 現在時刻をチェック
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours + minutes/60;
    
    // 6:30-8:00の間のみアクセス許可
    if (currentTime < 6.5 || currentTime > 8.0) {
      return res.status(403).json({
        success: false,
        message: 'この機能は朝6:30から8:00の間のみ利用可能です。'
      });
    }
    
    next();
  } catch (error) {
    console.error('時間制限チェックエラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。'
    });
  }
};

module.exports = { protect, admin, timeRestriction };
