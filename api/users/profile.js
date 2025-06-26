// Vercel Function: /api/users/profile
// ユーザープロフィール管理API（MongoDB Atlas専用版）

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { connectMongoose } = require('../_lib/database');

// 環境変数のデフォルト設定
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

// パスワードハッシュ化ミドルウェア
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
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
  console.log(`👤 Profile API: ${req.method} ${req.url}`);
  
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

  try {
    // GET - プロフィール取得
    if (req.method === 'GET') {
      return await getUserProfile(req, res);
    }
    
    // PUT - プロフィール更新
    if (req.method === 'PUT') {
      return await updateUserProfile(req, res);
    }

    // その他のメソッドは許可しない
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
};

// MongoDB接続は _lib/database.js の connectMongoose() を使用（キャッシュ済み）

// JWT検証
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

// プロフィール取得
async function getUserProfile(req, res) {
  try {
    console.log('📖 Getting user profile from MongoDB Atlas...');
    
    // 認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '認証トークンが必要です'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: '無効な認証トークンです'
      });
    }

    // MongoDB Atlas接続
    await connectMongoose();
    
    // ユーザーをEmailで検索（ObjectIdではなく）
    let user = await User.findOne({ email: decoded.email }).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    console.log('✅ Profile retrieved from MongoDB Atlas:', user.username);

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        points: user.points || 0,
        streak: user.streak || 0,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
}

// プロフィール更新
async function updateUserProfile(req, res) {
  try {
    console.log('📝 Updating user profile in MongoDB Atlas...');
    console.log('Request body:', req.body);
    
    // 認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '認証トークンが必要です'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: '無効な認証トークンです'
      });
    }

    const { username, email, grade, avatar } = req.body;

    // バリデーション
    if (username && (!username.trim() || username.trim().length < 2)) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名は2文字以上で入力してください'
      });
    }

    // 学年バリデーション：1-15(詳細区分), 99(ひみつ)
    if (grade !== undefined && grade !== null && grade !== '') {
      const gradeNum = parseInt(grade);
      const validGrades = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,99];
      if (isNaN(gradeNum) || !validGrades.includes(gradeNum)) {
        return res.status(400).json({
          success: false,
          message: '有効な学年を選択してください（1-6年生、その他、ひみつ）'
        });
      }
    }

    // MongoDB Atlas接続
    await connectMongoose();
    
    // ユーザーをEmailで検索
    const user = await User.findOne({ email: decoded.email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    // 更新データをセット
    if (username) user.username = username.trim();
    if (email) user.email = email.trim();
    if (grade) user.grade = parseInt(grade);
    if (avatar) user.avatar = avatar;
    user.updatedAt = new Date();

    const updatedUser = await user.save();

    console.log('✅ Profile updated successfully in MongoDB Atlas:', {
      username: updatedUser.username,
      grade: updatedUser.grade,
      avatar: updatedUser.avatar
    });

    // 新しいトークンを生成
    const userInfo = {
      username: updatedUser.username,
      email: updatedUser.email,
      grade: updatedUser.grade,
      avatar: updatedUser.avatar,
      isAdmin: updatedUser.isAdmin
    };
    
    const newToken = jwt.sign(
      { 
        userId: updatedUser._id,
        id: updatedUser._id,
        ...userInfo
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'プロフィールが更新されました',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        grade: updatedUser.grade,
        avatar: updatedUser.avatar,
        points: updatedUser.points || 0,
        streak: updatedUser.streak || 0,
        isAdmin: updatedUser.isAdmin
      },
      token: newToken
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
} 