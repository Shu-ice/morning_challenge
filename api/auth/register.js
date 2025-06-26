// Vercel Function: /api/auth/register
// MongoDB Atlas対応版ユーザー登録API

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

// User モデル
let User;
try {
  User = mongoose.model('User');
} catch {
  User = mongoose.model('User', userSchema);
}

// JWT生成ヘルパー関数
const generateToken = (userId, userInfo = {}) => {
  return jwt.sign(
    { 
      userId,
      ...userInfo
    }, 
    JWT_SECRET, 
    {
      expiresIn: '30d' // 30日間有効
    }
  );
};

module.exports = async function handler(req, res) {
  console.log(`📝 Register API: ${req.method} ${req.url}`);
  
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
    // MongoDB接続
    await connectMongoose();
    console.log('✅ MongoDB接続成功');

    // リクエストボディの取得と検証
    const { username, password, grade = 1, avatar = '😊' } = req.body;
    const email = (req.body.email || '').trim().toLowerCase(); // email正規化

    console.log('📝 Registration attempt:', { 
      email, 
      username, 
      grade,
      avatar: avatar || '😊'
    });

    // 必須フィールドの検証
    if (!email || !username || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Invalid',
        message: 'メールアドレス、ユーザー名、パスワードは必須です'
      });
    }

    // usernameもトリム・正規化
    const normalizedUsername = username.trim();

    // メールアドレス重複チェック
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      console.log('❌ Email already exists:', email);
      return res.status(400).json({
        success: false,
        error: 'Invalid',
        message: 'このメールアドレスは既に使用されています'
      });
    }

    // ユーザー名重複チェック
    const existingUsernameUser = await User.findOne({ username: normalizedUsername });
    if (existingUsernameUser) {
      console.log('❌ Username already exists:', normalizedUsername);
      return res.status(400).json({
        success: false,
        error: 'Invalid',
        message: 'このユーザー名は既に使用されています'
      });
    }

    // パスワードハッシュ化
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザー作成
    const newUser = new User({
      username: normalizedUsername,
      email,
      password: hashedPassword,
      grade: Number(grade) || 1,
      avatar: avatar || '😊',
      isAdmin: false, // 新規登録ユーザーは管理者ではない
      points: 0,
      streak: 0
    });

    const savedUser = await newUser.save();
    console.log('✅ User created successfully:', savedUser._id);

    // JWTトークン生成
    const userInfo = {
      username: savedUser.username,
      email: savedUser.email,
      grade: savedUser.grade,
      avatar: savedUser.avatar,
      isAdmin: savedUser.isAdmin
    };
    
    const token = generateToken(savedUser._id, userInfo);

    // 成功レスポンス（loginと同じ形式）
    const responseData = {
      success: true,
      message: 'ユーザー登録が完了しました',
      token,
      user: {
        _id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        grade: savedUser.grade,
        avatar: savedUser.avatar,
        isAdmin: savedUser.isAdmin,
        points: savedUser.points,
        streak: savedUser.streak,
        createdAt: savedUser.createdAt
      }
    };

    console.log('✅ Registration successful for:', savedUser.email);
    return res.status(201).json(responseData);

  } catch (error) {
    console.error('💥 Registration error:', error);

    // MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message = field === 'email' 
        ? 'このメールアドレスは既に使用されています'
        : 'このユーザー名は既に使用されています';
      
      return res.status(400).json({
        success: false,
        error: 'Invalid',
        message
      });
    }

    // バリデーションエラー
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors)[0]?.message || '入力データが正しくありません';
      return res.status(400).json({
        success: false,
        error: 'Invalid',
        message
      });
    }

    // その他のエラー
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'ユーザー登録中にエラーが発生しました'
    });
  }
};