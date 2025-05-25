import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// JWT トークン生成ヘルパー関数
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  console.log('[authController] registerUser function started');
  const { username, email, password, grade, avatar } = req.body;

  try {
    // メールアドレスが既に存在するか確認
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400); // Bad Request
      throw new Error('このメールアドレスは既に使用されています');
    }

    // ユーザー名が既に存在するか確認
    const usernameExists = await User.findOne({ username });
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
      const token = generateToken(user._id);

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
  console.log(`[${new Date(startTime).toISOString()}] [authController] loginUser function started`);
  const { email, password } = req.body;
  console.log(`[Login attempt] Email: ${email}, Password provided: ${password ? 'Yes' : 'No'}`);

  try {
    console.log(`[${new Date().toISOString()}] [authController] Searching for user by email: ${email}`);
    const user = await User.findOne({ email }).select('+password');
    const userSearchTime = Date.now();
    console.log(`[${new Date(userSearchTime).toISOString()}] [authController] User search completed. Duration: ${userSearchTime - startTime}ms. User found: ${user ? user.username : 'null'}`);
    console.log(`[Login user found] User: ${user ? user.username : 'null'}, Password in DB: ${user && user.password ? 'Exists' : 'Missing or null'}`);

    if (user) {
      console.log(`[${new Date().toISOString()}] [authController] Comparing password for user: ${user.username}`);
      console.log(`[Login user.password type] ${typeof user.password}, length: ${user.password ? user.password.length : 'N/A'}`);
      const isMatch = await user.matchPassword(password);
      const passwordMatchTime = Date.now();
      console.log(`[${new Date(passwordMatchTime).toISOString()}] [authController] Password comparison completed. Duration: ${passwordMatchTime - userSearchTime}ms. Is match: ${isMatch}`);
      console.log(`[Login password match result] Is match: ${isMatch}`);

      if (isMatch) {
        const token = generateToken(user._id);

        // クッキーにトークンを設定
        res.cookie('jwt', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.json({
          _id: user._id,
          username: user.username,
          email: user.email,
          grade: user.grade,
          avatar: user.avatar,
          isAdmin: user.isAdmin,
          token: token,
        });
        const endTime = Date.now();
        console.log(`[${new Date(endTime).toISOString()}] [authController] loginUser successful for ${email}. Total duration: ${endTime - startTime}ms`);
      } else {
        const endTime = Date.now();
        console.log(`[${new Date(endTime).toISOString()}] [authController] Login attempt failed for ${email}: Password mismatch. Total duration: ${endTime - startTime}ms`);
        console.log('[Login attempt failed] User not found or password mismatch.');
        res.status(401); // Unauthorized
        throw new Error('メールアドレスまたはパスワードが無効です');
      }
    } else {
      const endTime = Date.now();
      console.log(`[${new Date(endTime).toISOString()}] [authController] Login attempt failed for ${email}: User not found. Total duration: ${endTime - startTime}ms`);
      console.log('[Login attempt failed] User not found or password mismatch.');
      res.status(401); // Unauthorized
      throw new Error('メールアドレスまたはパスワードが無効です');
    }
  } catch (error) {
    const endTime = Date.now();
    console.error(`[${new Date(endTime).toISOString()}] [authController] loginUser error for ${email}. Total duration: ${endTime - startTime}ms. Error: ${error.message}`);
    next(error);
  }
};

// TODO: Add logoutUser controller

export {
  registerUser,
  loginUser
}; 