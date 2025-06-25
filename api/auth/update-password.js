// Vercel Function: /api/auth/update-password
// パスワード変更API

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
  console.log(`🔒 Update Password API: ${req.method} ${req.url}`);
  
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

  // PUTリクエストのみ許可
  if (req.method !== 'PUT') {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    console.log(`🔒 Password update request for authenticated user`);

    // バリデーション
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '現在のパスワードと新しいパスワードの両方が必要です'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新しいパスワードは6文字以上である必要があります'
      });
    }

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

    // MongoDB接続（キャッシュ済み接続を使用）
    await connectMongoose();
    
    // ユーザーをEmailで検索
    const user = await User.findOne({ email: decoded.email });
    
    if (!user) {
      console.log(`❌ User not found: ${decoded.email}`);
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    // 現在のパスワード検証
    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      console.log(`❌ Invalid current password for: ${decoded.email}`);
      return res.status(401).json({
        success: false,
        message: '現在のパスワードが間違っています'
      });
    }

    // 新しいパスワードと現在のパスワードが同じでないかチェック
    const isSamePassword = await user.matchPassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: '新しいパスワードは現在のパスワードと異なる必要があります'
      });
    }

    // 新しいパスワードをハッシュ化
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // パスワード更新
    user.password = hashedPassword;
    user.updatedAt = new Date();
    await user.save();

    console.log(`✅ Password updated successfully for: ${user.username} (${user.email})`);

    return res.status(200).json({
      success: true,
      message: 'パスワードが正常に更新されました'
    });

  } catch (error) {
    console.error('❌ Update Password API error:', error);
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