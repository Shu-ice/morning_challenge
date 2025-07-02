// Vercel Function: /api/admin/users/[userId]
// 管理者用ユーザー権限管理API
const { connectMongoose } = require('../../_lib/database');
const { User } = require('../../_lib/models');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const logger = {
  info: (...args) => !process.env.VERCEL && console.log('[Admin/UserById]', ...args),
  debug: (...args) => !process.env.VERCEL && console.debug('[Admin/UserById]', ...args),
  warn: (...args) => console.warn('[Admin/UserById]', ...args),
  error: (...args) => console.error('[Admin/UserById]', ...args)
};

// モック環境判定
const isMongoMock = () => process.env.MONGODB_MOCK === 'true';

// モックデータ
const getMockUsers = () => [
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

// URLパスからuserIdを抽出
const getUserIdFromPath = (req) => {
  const urlParts = req.url.split('/');
  const userIdIndex = urlParts.findIndex(part => part === 'users') + 1;
  return urlParts[userIdIndex]?.split('?')[0]; // クエリパラメータを除去
};

// 管理者権限を付与
const makeUserAdmin = async (req, res, userId) => {
  logger.info(`ユーザー ${userId} に管理者権限を付与`);

  if (isMongoMock()) {
    // モック環境での処理
    const mockUsers = getMockUsers();
    const userIndex = mockUsers.findIndex(user => user._id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
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
};

// 管理者権限を削除
const removeUserAdmin = async (req, res, userId) => {
  logger.info(`ユーザー ${userId} の管理者権限を削除`);

  if (isMongoMock()) {
    // モック環境での処理
    const mockUsers = getMockUsers();
    const userIndex = mockUsers.findIndex(user => user._id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    mockUsers[userIndex].isAdmin = false;
    
    logger.info(`モック環境でユーザー ${userId} の管理者権限を削除`);
    return res.status(200).json({
      success: true,
      message: 'ユーザーの管理者権限を削除しました',
      data: {
        userId,
        username: mockUsers[userIndex].username,
        isAdmin: false
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

  if (!user.isAdmin) {
    return res.status(400).json({
      success: false,
      message: 'このユーザーは管理者ではありません'
    });
  }

  await User.findByIdAndUpdate(userId, { isAdmin: false });

  logger.info(`ユーザー ${user.username} (${userId}) の管理者権限を削除`);

  return res.status(200).json({
    success: true,
    message: 'ユーザーの管理者権限を削除しました',
    data: {
      userId,
      username: user.username,
      email: user.email,
      isAdmin: false
    }
  });
};

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 認証チェック
    authenticate(req);

    // UserIDを取得
    const userId = getUserIdFromPath(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDが必要です'
      });
    }

    logger.debug(`リクエスト処理開始: ${req.method} ${req.url}, userId: ${userId}`);

    // メソッド別処理
    if (req.method === 'PUT') {
      // URL パスから action を判定
      const urlPath = req.url;
      
      if (urlPath.includes('/make-admin')) {
        return await makeUserAdmin(req, res, userId);
      } else if (urlPath.includes('/remove-admin')) {
        return await removeUserAdmin(req, res, userId);
      } else {
        return res.status(400).json({
          success: false,
          message: '無効なアクションです。/make-admin または /remove-admin を指定してください'
        });
      }
    } else {
      return res.status(405).json({
        success: false,
        message: `Method ${req.method} not allowed`
      });
    }

  } catch (error) {
    logger.error('ユーザー権限管理エラー:', error);
    
    if (error.message.includes('認証') || error.message.includes('権限')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'ユーザー権限の更新に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};