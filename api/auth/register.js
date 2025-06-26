// 🔐 /api/auth/register - ユーザー登録API
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

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email and password are required'
      });
    }

    // パスワード長チェック
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // 既存ユーザーチェック
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // パスワードハッシュ化
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 新規ユーザー作成
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      grade: 1,
      avatar: '😊',
      isAdmin: false,
      points: 0,
      streak: 0
    });

    const savedUser = await newUser.save();

    // JWTトークン生成
    const token = jwt.sign(
      {
        _id: savedUser._id,
        email: savedUser.email,
        username: savedUser.username,
        isAdmin: savedUser.isAdmin,
        grade: savedUser.grade
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // レスポンス
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        grade: savedUser.grade,
        avatar: savedUser.avatar,
        isAdmin: savedUser.isAdmin,
        points: savedUser.points,
        streak: savedUser.streak
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};