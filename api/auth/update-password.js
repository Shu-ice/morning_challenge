// 🔐 /api/auth/update-password - パスワード更新API
// 🚀 最適化版 - グローバルキャッシュと一元化モデルを使用

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectMongoose } = require('../_lib/database');
const { User } = require('../_lib/models');

// 環境変数
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 🚀 最適化されたDB接続
    await connectMongoose();

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // パスワード長チェック
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // JWT認証
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // ユーザー取得
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // 現在のパスワード検証
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // 新しいパスワードハッシュ化
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // パスワード更新
    user.password = hashedNewPassword;
    user.updatedAt = new Date();
    await user.save();

    // 新しいJWTトークン生成
    const newToken = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
        grade: user.grade
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // レスポンス
    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      token: newToken
    });

  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}; 