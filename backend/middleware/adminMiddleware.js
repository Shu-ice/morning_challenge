// import jwt from 'jsonwebtoken'; // このファイルでは未使用のため削除
// import User from '../models/User.js'; // このファイルでは未使用のため削除

export const admin = (req, res, next) => {
  // protect ミドルウェアが先に実行されている前提
  if (req.user && req.user.isAdmin) {
    next(); // 管理者であれば次のミドルウェアへ
  } else {
    // res.status(403); // Forbidden
    // throw new Error('アクセス権限がありません。管理者のみアクセス可能です。');
    res.status(403).json({ success: false, error: 'アクセス権限がありません。管理者のみアクセス可能です。' });
  }
};

// module.exports = { admin }; // 削除 