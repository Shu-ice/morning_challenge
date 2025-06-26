// 🔐 /api/auth/login - ユーザーログインAPI
// 🚀 最適化版 - グローバルキャッシュと一元化モデルを使用

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectMongoose } = require('../_lib/database');
const { User } = require('../_lib/models');

// 環境変数
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // ユーザー検索
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // パスワード検証
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // JWTトークン生成
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
        grade: user.grade
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // レスポンス
    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        points: user.points,
        streak: user.streak
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}; 