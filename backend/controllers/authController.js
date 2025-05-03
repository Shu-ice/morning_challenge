const User = require('../models/User');
const { validationResult } = require('express-validator');

/**
 * @desc    ユーザー登録
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, grade } = req.body;

  try {
    // メールアドレスの重複チェック
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'このメールアドレスは既に使用されています'
      });
    }

    // ユーザー作成
    const user = await User.create({
      username,
      email,
      password,
      grade: parseInt(grade)
    });

    // JWTトークンの発行
    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        points: user.points,
        streak: user.streak
      }
    });
  } catch (error) {
    console.error('登録エラー:', error);
    res.status(500).json({
      success: false,
      error: '登録中にエラーが発生しました'
    });
  }
};

/**
 * @desc    ユーザーログイン
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // メールアドレスとパスワードがあるか確認
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'メールアドレスとパスワードを入力してください'
    });
  }

  try {
    // ユーザー検索（パスワードフィールドを含む）
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'メールアドレスまたはパスワードが正しくありません'
      });
    }

    // パスワード検証
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'メールアドレスまたはパスワードが正しくありません'
      });
    }

    // 連続ログイン確認と更新
    await updateLoginStreak(user);

    // JWTトークンの発行
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        points: user.points,
        streak: user.streak
      }
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    res.status(500).json({
      success: false,
      error: 'ログイン中にエラーが発生しました'
    });
  }
};

/**
 * @desc    ログイン中のユーザー情報を取得
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        points: user.points,
        streak: user.streak,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'ユーザー情報の取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    ユーザープロフィールを更新
 * @route   PUT /api/auth/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const { username, grade, avatar } = req.body;
    const updateData = {};

    // 更新フィールドの設定
    if (username) updateData.username = username;
    if (grade) updateData.grade = parseInt(grade);
    if (avatar) updateData.avatar = avatar;

    // ユーザー更新
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar,
        points: user.points,
        streak: user.streak
      }
    });
  } catch (error) {
    console.error('プロフィール更新エラー:', error);
    res.status(500).json({
      success: false,
      error: 'プロフィールの更新中にエラーが発生しました'
    });
  }
};

/**
 * 連続ログイン状況を更新
 * @param {Object} user - ユーザーオブジェクト
 */
const updateLoginStreak = async (user) => {
  const now = new Date();
  const lastLogin = new Date(user.lastLogin);

  // 日付部分だけを比較するために時間をリセット
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());

  // 今日すでにログインしている場合は何もしない
  if (nowDate.getTime() === lastDate.getTime()) {
    return;
  }

  // 前回のログインが昨日の場合は連続ログイン+1
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (nowDate.getTime() - lastDate.getTime() === oneDayMs) {
    user.streak += 1;
  } else {
    // 1日以上空いている場合はリセット
    user.streak = 1;
  }

  user.lastLogin = now;
  await user.save();
};