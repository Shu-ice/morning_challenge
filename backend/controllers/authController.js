import User from '../models/User.js';
import { validationResult } from 'express-validator';

/**
 * @desc    ユーザー登録
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res) => {
  // ★ デバッグログ追加: リクエストボディの内容を確認
  console.log('Register request body:', req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, grade } = req.body;

  try {
    // メールアドレスの重複チェック
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'このメールアドレスは既に使用されています'
      });
    }

    // ★ 追加: ユーザー名の重複チェック
    existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'このユーザー名は既に使用されています'
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
export const login = async (req, res) => {
  // ★ デバッグログ追加: リクエストボディの内容を確認
  console.log('Login request body:', req.body);

  const { username, email, password } = req.body; // email にメールアドレスが入力されている想定

  // ★ 修正: email と password の存在をチェック
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'メールアドレスとパスワードを入力してください'
    });
  }

  try {
    // ★ 修正: email でユーザーを検索する
    const query = { email: email }; // email フィールドで検索
    console.log('[Login] Attempting to find user with query:', query);

    const user = await User.findOne(query).select('+password');
    
    // ★ ユーザーが見つからなかった場合のログ
    if (!user) {
      console.log('[Login] User not found with query:', query);
      return res.status(401).json({
        success: false,
        error: 'ユーザー名（またはメールアドレス）またはパスワードが正しくありません'
      });
    }

    // ★ デバッグログ追加: ユーザー情報を確認
    console.log('Found user:', {
      id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin
    });

    // パスワード検証
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'ユーザー名（またはメールアドレス）またはパスワードが正しくありません'
      });
    }

    // 連続ログイン確認と更新
    await updateLoginStreak(user);

    // ★ デバッグログ追加
    console.log('[authController.js] Calling user.getSignedJwtToken() to generate token');
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
        streak: user.streak,
        isAdmin: user.isAdmin
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
export const getMe = async (req, res) => {
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
export const updateProfile = async (req, res) => {
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
 * @desc    パスワードを更新
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
export const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // 入力チェック
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: '現在のパスワードと新しいパスワードを入力してください'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: '新しいパスワードは6文字以上である必要があります'
    });
  }

  try {
    // ユーザーをIDで検索し、パスワードフィールドも取得
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      // 通常は protect ミドルウェアで弾かれるはずだが念のため
      return res.status(404).json({ success: false, error: 'ユーザーが見つかりません' });
    }

    // 現在のパスワードが正しいか検証
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: '現在のパスワードが正しくありません' });
    }

    // 新しいパスワードをハッシュ化して保存
    user.password = newPassword; // pre('save') フックでハッシュ化される
    await user.save();

    // ★ パスワード変更成功時はトークンを再発行しない（通常は不要）
    // 必要であればここで新しいトークンを発行して返すことも可能
    // const token = user.getSignedJwtToken(); 

    res.status(200).json({ success: true, message: 'パスワードが正常に変更されました' });

  } catch (error) {
    console.error('パスワード更新エラー:', error);
    res.status(500).json({
      success: false,
      error: 'パスワードの更新中にエラーが発生しました'
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

/**
 * @desc    管理者権限を設定（開発環境専用）
 * @route   POST /api/auth/set-admin
 * @access  Private/Admin
 */
export const setAdmin = async (req, res) => {
  try {
    const { email } = req.body;

    // 環境チェック（本番環境では実行不可）
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'この操作は本番環境では実行できません'
      });
    }

    // ユーザーを検索
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '指定されたメールアドレスのユーザーが見つかりません'
      });
    }

    // 管理者権限を設定
    user.isAdmin = true;
    await user.save();

    console.log(`管理者権限を設定しました: ${email}`);

    res.status(200).json({
      success: true,
      message: '管理者権限を設定しました',
      user: {
        id: user._id,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('管理者権限設定エラー:', error);
    res.status(500).json({
      success: false,
      error: '管理者権限の設定中にエラーが発生しました'
    });
  }
};