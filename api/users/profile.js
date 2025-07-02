// 👤 /api/users/profile - ユーザープロフィールAPI
// 🚀 最適化版 - グローバルキャッシュと一元化モデルを使用

const jwt = require('jsonwebtoken');
const { connectMongoose } = require('../../shared_lib/database');
const { User } = require('../../shared_lib/models');

// 環境変数
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 🚀 最適化されたDB接続
    await connectMongoose();

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

    if (req.method === 'GET') {
      // プロフィール取得
      return res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          grade: user.grade,
          avatar: user.avatar,
          isAdmin: user.isAdmin,
          points: user.points,
          streak: user.streak,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    }

    if (req.method === 'PUT') {
      // プロフィール更新
      const { username, avatar, grade } = req.body;
      const updates = {};

      if (username && username.trim()) {
        // ユーザー名重複チェック
        const existingUser = await User.findOne({ 
          username: username.toLowerCase(),
          _id: { $ne: user._id }
        });
        
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: 'Username already exists'
          });
        }
        
        updates.username = username.toLowerCase();
      }

      if (avatar) {
        updates.avatar = avatar;
      }

      if (grade !== undefined && !isNaN(grade)) {
        updates.grade = Number(grade);
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        Object.assign(user, updates);
        await user.save();
      }

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          grade: user.grade,
          avatar: user.avatar,
          isAdmin: user.isAdmin,
          points: user.points,
          streak: user.streak,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}; 