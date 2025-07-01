import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import environmentConfig from '../config/environment.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = environmentConfig.jwtSecret;
const JWT_EXPIRES_IN = environmentConfig.jwtExpiresIn;

// JWT トークン生成ヘルパー関数
const generateToken = (userId, userInfo = {}) => {
  return jwt.sign({ 
    userId,
    ...userInfo
  }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  logger.debug('registerUser function started');
  const { username, password, grade, avatar } = req.body;
  const email = (req.body.email || '').trim().toLowerCase();

  try {
    // メールアドレスが既に存在するか確認（モック環境対応）
    const userExists = await User.findOneSimple({ email });
    if (userExists) {
      res.status(400); // Bad Request
      throw new Error('このメールアドレスは既に使用されています');
    }

    // ユーザー名が既に存在するか確認（モック環境対応）
    const usernameExists = await User.findOneSimple({ username });
    if (usernameExists) {
      res.status(400);
      throw new Error('このユーザー名は既に使用されています');
    }

    // 新しいユーザーを作成 (パスワードは pre-save フックでハッシュ化される)
    const user = await User.create({
      username,
      email,
      password, // 平文のパスワードを渡す
      grade,
      avatar,
    });

    if (user) {
      const userInfo = {
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        isAdmin: user.isAdmin
      };
      const token = generateToken(user._id, userInfo);

      // クッキーにトークンを設定 (HttpOnlyでセキュリティ向上)
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development', // 本番環境では HTTPS のみ
        sameSite: 'strict', // CSRF対策
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
      });

      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        token: token, // フロントエンドで状態管理用にトークンも返す
      });
    } else {
      res.status(400);
      throw new Error('無効なユーザーデータです');
    }
  } catch (error) {
    // エラーハンドリングミドルウェアに処理を委譲
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  const startTime = Date.now();
  logger.debug('loginUser function started');
  let { email, password } = req.body;
  email = (email || '').trim().toLowerCase();
  logger.info(`Login attempt for email: ${email}`);
  logger.debug(`Request body keys: ${Object.keys(req.body)}`);
  logger.debug(`Email provided: ${!!email}, Password provided: ${!!password}`);

  try {
    // バリデーション: emailとpasswordが提供されているか確認
    if (!email || !password) {
      logger.error(`Login validation failed - Email: ${!!email}, Password: ${!!password}`);
      res.status(400);
      throw new Error('メールアドレスとパスワードの両方が必要です');
    }

    logger.debug(`Searching for user by email: ${email}`);
    logger.debug(`Environment: MONGODB_MOCK=${process.env.MONGODB_MOCK}`);
    
    // 🔥 緊急修正: モック環境でのfindOne処理
    const userFindQuery = User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    logger.debug(`User query created: ${typeof userFindQuery}`);
    
    const user = await (userFindQuery.select ? userFindQuery.select('+password') : userFindQuery);
    logger.debug(`User search result: ${JSON.stringify(user ? { username: user.username, email: user.email, hasPassword: !!user.password, isAdmin: user.isAdmin } : null)}`);
    
    const userSearchTime = Date.now();
    logger.debug(`User search completed. Duration: ${userSearchTime - startTime}ms. User found: ${!!user}`);

    if (user) {
      logger.debug(`Found user: ${user.username}, isAdmin: ${user.isAdmin}`);
      logger.debug(`User has matchPassword method: ${typeof user.matchPassword === 'function'}`);
      logger.debug(`User password exists: ${!!user.password}`);
      
      // Safeguard: if user document does not have matchPassword (e.g. lean object)
      if (typeof user.matchPassword !== 'function') {
        logger.error(`User document for ${email} missing matchPassword method. Possible lean result.`);
        res.status(401);
        throw new Error('メールアドレスまたはパスワードが無効です');
      }

      logger.debug(`Comparing password for user: ${user.username}`);
      const isMatch = await user.matchPassword(password);
      const passwordMatchTime = Date.now();
      logger.debug(`Password comparison completed. Duration: ${passwordMatchTime - userSearchTime}ms. Is match: ${isMatch}`);

      if (isMatch) {
        // 最新のユーザー情報をトークンに含める
        const userInfo = {
          username: user.username,
          email: user.email,
          grade: user.grade,
          avatar: user.avatar,
          isAdmin: user.isAdmin
        };
        logger.debug(`Creating token with userInfo: ${JSON.stringify(userInfo)}`);
        
        const token = generateToken(user._id, userInfo);
        logger.debug(`Token generated successfully`);

        // クッキーにトークンを設定
        res.cookie('jwt', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        const loginResult = {
          success: true,
          message: 'ログインしました。',
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            grade: user.grade,
            avatar: user.avatar,
            isAdmin: user.isAdmin,
            isLoggedIn: true
          },
          token: token,
        };
        
        logger.info(`Login successful for ${email}. User isAdmin: ${user.isAdmin}`);
        logger.debug(`Sending login result: ${JSON.stringify(loginResult)}`);
        
        res.json(loginResult);
        const endTime = Date.now();
        logger.info(`Login completed for ${email}. Duration: ${endTime - startTime}ms`);
      } else {
        const endTime = Date.now();
        logger.warn(`Login failed for ${email}: Invalid credentials. Duration: ${endTime - startTime}ms`);
        res.status(401); // Unauthorized
        throw new Error('メールアドレスまたはパスワードが無効です');
      }
    } else {
      const endTime = Date.now();
      logger.warn(`Login failed for ${email}: User not found. Duration: ${endTime - startTime}ms`);
      res.status(401); // Unauthorized
      throw new Error('メールアドレスまたはパスワードが無効です');
    }
  } catch (error) {
    const endTime = Date.now();
    logger.error(`Login error for ${email}. Duration: ${endTime - startTime}ms. Error: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    next(error);
  }
};

// TODO: Add logoutUser controller

// @desc    Update user password
// @route   PUT /api/auth/update-password
// @access  Private
const updatePassword = async (req, res, next) => {
  logger.debug('updatePassword function started');
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id; // authMiddleware から取得

  try {
    // 現在のパスワードと新しいパスワードが提供されているか確認
    if (!currentPassword || !newPassword) {
      res.status(400);
      throw new Error('現在のパスワードと新しいパスワードの両方が必要です');
    }

    // 新しいパスワードの長さチェック
    if (newPassword.length < 6) {
      res.status(400);
      throw new Error('新しいパスワードは6文字以上である必要があります');
    }

    // ユーザーをIDで検索し、パスワードフィールドも含める
    const userQuery = User.findById(userId);
    const user = await (userQuery.select ? userQuery.select('+password') : userQuery);

    if (!user) {
      res.status(404);
      throw new Error('ユーザーが見つかりません');
    }

    // 現在のパスワードが正しいか確認
    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      res.status(401);
      throw new Error('現在のパスワードが間違っています');
    }

    // 新しいパスワードと現在のパスワードが同じでないか確認
    const isSamePassword = await user.matchPassword(newPassword);
    if (isSamePassword) {
      res.status(400);
      throw new Error('新しいパスワードは現在のパスワードと異なる必要があります');
    }

    // 新しいパスワードを設定（pre-saveフックでハッシュ化される）
    user.password = newPassword;
    await user.save();

    logger.info(`Password updated successfully for user: ${user.username}`);

    res.json({
      success: true,
      message: 'パスワードが正常に更新されました'
    });

  } catch (error) {
    logger.error(`updatePassword error for user ${userId}: ${error.message}`);
    next(error);
  }
};

export {
  registerUser,
  loginUser,
  updatePassword
}; 