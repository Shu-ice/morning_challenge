// Vercel Function: /api/auth/login
// MongoDB Atlas対応版ログインAPI

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { connectMongoose } = require('../_lib/database');

// 環境変数設定
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// MongoDBスキーマ定義
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  grade: { type: Number, default: 1 },
  avatar: { type: String, default: '😊' },
  isAdmin: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// パスワード比較メソッド
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// User モデル
let User;
try {
  User = mongoose.model('User');
} catch {
  User = mongoose.model('User', userSchema);
}

module.exports = async function handler(req, res) {
  console.log(`🔐 Login API: ${req.method} ${req.url}`);
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエスト処理
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS handled');
    return res.status(200).end();
  }

  // POSTリクエストのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    let { email, password } = req.body;
    // 入力を正規化して大小・前後空白の差異による認証失敗を防ぐ
    email = (email || '').trim().toLowerCase();
    console.log(`🚀 Login request for: ${email}`);

    // バリデーション
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // MongoDB接続（キャッシュ済み接続を使用）
    await connectMongoose();
    
    // MongoDB内でユーザーを検索（正規化済みメールアドレス、既存データとの大文字小文字差異を吸収）
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // パスワード検証
    const isPasswordValid = await user.matchPassword(password);
    
    if (!isPasswordValid) {
      console.log(`❌ Invalid password for: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    console.log(`✅ Authentication successful for: ${user.username} (${user.email})`);

    // 実際のユーザーデータでJWTトークンを生成
    const token = jwt.sign(
      { 
        userId: user._id,
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        grade: user.grade,
        avatar: user.avatar
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`🔑 JWT token generated for real user: ${user.username}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        points: user.points || 0,
        streak: user.streak || 0
      },
      token: token,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Login API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// MongoDB接続は _lib/database.js の connectMongoose() を使用（キャッシュ済み） 