// Vercel Function: /api/admin/users/[userId]/make-admin
// 管理者権限付与API
const { connectMongoose } = require('../../../_lib/database');
const { User } = require('../../../_lib/models');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const logger = {
  info: (...args) => !process.env.VERCEL && console.log('[Admin/MakeAdmin]', ...args),
  debug: (...args) => !process.env.VERCEL && console.debug('[Admin/MakeAdmin]', ...args),
  warn: (...args) => console.warn('[Admin/MakeAdmin]', ...args),
  error: (...args) => console.error('[Admin/MakeAdmin]', ...args)
};

// モック環境判定
const isMongoMock = () => process.env.MONGODB_MOCK === 'true';

// モックデータ
let mockUsers = [
  {
    _id: 'user1',
    username: 'admin',
    email: 'admin@example.com',
    grade: 4,
    isAdmin: true,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'user2',
    username: 'testuser',
    email: 'test@example.com',
    grade: 3,
    isAdmin: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'user3',
    username: 'student1',
    email: 'student1@example.com',
    grade: 5,
    isAdmin: false,
    createdAt: new Date().toISOString()
  }
];

// JWT認証ミドルウェア
const authenticate = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証トークンが必要です');
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    if (!decoded.isAdmin) {
      throw new Error('管理者権限が必要です');
    }
    return decoded;
  } catch (error) {
    throw new Error('無効な認証トークンです');
  }
};

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    // 認証チェック
    authenticate(req);

    // UserIDを取得（Vercel Dynamic Routingから）
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDが必要です'
      });
    }

    logger.info(`ユーザー ${userId} に管理者権限を付与`);

    if (isMongoMock()) {
      // モック環境での処理
      const userIndex = mockUsers.findIndex(user => user._id === userId);
      
      if (userIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      if (mockUsers[userIndex].isAdmin) {
        return res.status(400).json({
          success: false,
          message: 'このユーザーは既に管理者です'
        });
      }

      mockUsers[userIndex].isAdmin = true;
      
      logger.info(`モック環境でユーザー ${userId} を管理者に設定`);
      return res.status(200).json({
        success: true,
        message: 'ユーザーに管理者権限を付与しました',
        data: {
          userId,
          username: mockUsers[userIndex].username,
          isAdmin: true
        }
      });
    }

    // MongoDB環境での処理
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: '無効なユーザーIDです'
      });
    }

    await connectMongoose();

    const user = await User.findById(userId).select('username email isAdmin');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    if (user.isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'このユーザーは既に管理者です'
      });
    }

    await User.findByIdAndUpdate(userId, { isAdmin: true });

    logger.info(`ユーザー ${user.username} (${userId}) を管理者に設定`);

    return res.status(200).json({
      success: true,
      message: 'ユーザーに管理者権限を付与しました',
      data: {
        userId,
        username: user.username,
        email: user.email,
        isAdmin: true
      }
    });

  } catch (error) {
    logger.error('管理者権限付与エラー:', error);
    
    if (error.message.includes('認証') || error.message.includes('権限')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: '管理者権限の付与に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};