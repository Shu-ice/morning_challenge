import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import Result from '../models/Result.js';
import { updateGradeForUserResults } from '../config/database.js';

// トークン生成関数
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'morningmathsecret', {
    expiresIn: '30d'
  });
};

// @desc    ユーザー登録
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { username, password, grade } = req.body;
    
    if (!username || !password || !grade) {
      return res.status(400).json({
        success: false, 
        message: 'すべての項目を入力してください'
      });
    }
    
    // ユーザー名の存在確認
    const userExists = await User.findOne({ username });
    
    if (userExists) {
      return res.status(400).json({
        success: false, 
        message: 'このユーザー名はすでに使用されています'
      });
    }
    
    // ユーザー作成
    const user = await User.create({
      username,
      password,
      grade: parseInt(grade),
      avatar: '😊',  // デフォルトアバター
      streak: 1      // 初回ログイン
    });
    
    if (user) {
      // トークンの作成・送信
      const token = generateToken(user._id);
      
      // クッキーにトークンを保存
      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
      });
      
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          username: user.username,
          grade: user.grade,
          avatar: user.avatar,
          points: user.points,
          streak: user.streak
        },
        token
      });
    } else {
      res.status(400).json({
        success: false, 
        message: 'ユーザー登録に失敗しました'
      });
    }
  } catch (error) {
    logger.error('ユーザー登録エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザーログイン
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false, 
        message: 'ユーザー名とパスワードを入力してください'
      });
    }
    
    // ユーザー検索（パスワードフィールドを含める）
    const user = await User.findOne({ username }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false, 
        message: 'ユーザー名またはパスワードが正しくありません'
      });
    }
    
    // パスワード照合
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false, 
        message: 'ユーザー名またはパスワードが正しくありません'
      });
    }
    
    // 連続ログイン更新
    await user.updateStreak();
    
    // トークン作成
    const token = generateToken(user._id);
    
    // クッキーにトークンを保存
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        grade: user.grade,
        avatar: user.avatar,
        points: user.points,
        streak: user.streak,
        items: user.items
      },
      token
    });
  } catch (error) {
    logger.error('ログインエラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザープロフィールの取得
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false, 
        message: 'ユーザーが見つかりません'
      });
    }
    
    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        grade: user.grade,
        avatar: user.avatar,
        points: user.points,
        streak: user.streak,
        items: user.items,
        records: user.records,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('プロファイル取得エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザープロフィールの更新
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { username, email, grade, avatar } = req.body;
    
    logger.debug(`[updateUserProfile] 開始: userId=${userId}, grade=${grade}, avatar=${avatar}`);
    
    // モック環境での確実な更新処理
    if (process.env.MONGODB_MOCK === 'true') {
      const { updateMockUserUnified, getMockUserUnified } = await import('../config/database.js');
      
      // 更新前のデータ確認
      const beforeUpdate = getMockUserUnified({ _id: userId });
      if (!beforeUpdate) {
        logger.error(`[updateUserProfile] ユーザーが見つかりません: ${userId}`);
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }
      
      logger.debug(`[updateUserProfile] 更新前: username=${beforeUpdate.username}, grade=${beforeUpdate.grade}, avatar=${beforeUpdate.avatar}`);
      
      // 更新データの準備
      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (grade !== undefined) updateData.grade = Number(grade);
      if (avatar !== undefined) updateData.avatar = avatar;
      
      logger.debug(`[updateUserProfile] 更新データ:`, updateData);
      
      // 更新実行
      const updatedUser = updateMockUserUnified(userId, updateData);
      
      if (!updatedUser) {
        logger.error(`[updateUserProfile] 更新に失敗しました: ${userId}`);
        return res.status(500).json({
          success: false,
          message: 'プロフィール更新に失敗しました'
        });
      }
      
      logger.debug(`[updateUserProfile] 更新後: username=${updatedUser.username}, grade=${updatedUser.grade}, avatar=${updatedUser.avatar}`);
      
      // 新しいトークンを生成
      const userInfo = {
        username: updatedUser.username,
        email: updatedUser.email,
        grade: updatedUser.grade,
        avatar: updatedUser.avatar,
        isAdmin: updatedUser.isAdmin
      };
      const newToken = generateToken(userId, userInfo);
      
      // クッキーも更新
      res.cookie('token', newToken, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
      });
      
      return res.json({
        success: true,
        message: 'プロフィールが更新されました',
        user: {
          _id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          grade: updatedUser.grade,
          avatar: updatedUser.avatar,
          points: updatedUser.points || 0,
          streak: updatedUser.streak || 0
        },
        token: newToken
      });
    }
    
    // 通常のMongoose処理
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false, 
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 更新するフィールドをセット
    if (username) user.username = username;
    if (email) user.email = email;
    if (grade) user.grade = parseInt(grade);
    if (avatar) user.avatar = avatar;
    
    const updatedUser = await user.save();
    
    /** 結果テーブルに学年を同期 */
    try {
      await Result.updateMany({ userId: updatedUser._id }, { grade: updatedUser.grade });
      logger.debug(`[UserProfile] Result.grade を一括更新: user=${updatedUser.username}, grade=${updatedUser.grade}`);
    } catch(syncErr) {
      logger.warn('[UserProfile] Result の grade 同期に失敗:', syncErr);
    }
    
    // 新しいトークンを生成
    const userInfo = {
      username: updatedUser.username,
      email: updatedUser.email,
      grade: updatedUser.grade,
      avatar: updatedUser.avatar,
      isAdmin: updatedUser.isAdmin
    };
    const newToken = generateToken(updatedUser._id, userInfo);
    
    // クッキーも更新
    res.cookie('token', newToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.json({
      success: true,
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        grade: updatedUser.grade,
        avatar: updatedUser.avatar,
        points: updatedUser.points,
        streak: updatedUser.streak
      },
      token: newToken
    });
  } catch (error) {
    logger.error('プロファイル更新エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザーのアイテム購入
// @route   POST /api/users/purchase
// @access  Private
export const purchaseItem = async (req, res) => {
  try {
    const { itemId } = req.body;
    const user = await User.findById(req.user._id);
    const { default: Item } = await import('../models/Item.js');
    const item = await Item.findById(itemId);
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    if (!item) {
      return res.status(404).json({ message: 'アイテムが見つかりません' });
    }
    
    // ポイント不足チェック
    if (user.points < item.pointCost) {
      return res.status(400).json({ message: 'ポイントが足りません' });
    }
    
    // 学年制限チェック
    if (item.gradeRestriction && user.grade < item.gradeRestriction) {
      return res.status(400).json({ message: `このアイテムは${item.gradeRestriction}年生以上が対象です` });
    }
    
    // アイテムの重複所持チェック
    const hasItem = user.items.some(userItem => userItem.name === item.name);
    if (hasItem) {
      return res.status(400).json({ message: '既に所持しているアイテムです' });
    }
    
    // ポイントを減らしてアイテムを追加
    user.points -= item.pointCost;
    user.items.push({
      name: item.name,
      description: item.description,
      acquiredDate: new Date()
    });
    
    await user.save();
    
    res.json({
      message: `${item.name}を購入しました！`,
      currentPoints: user.points,
      items: user.items
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    ユーザーログアウト
// @route   POST /api/users/logout
// @access  Private
export const logoutUser = (req, res) => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0)
    });
    
    res.json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error) {
    logger.error('ログアウトエラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    トップユーザーの取得（ランキング用）
// @route   GET /api/users/top
// @access  Public
export const getTopUsers = async (req, res) => {
  try {
    const { period, limit } = req.query;
    const userLimit = parseInt(limit) || 10;
    
    let dateFilter = {};
    const now = new Date();
    
    // 期間フィルターの設定
    if (period === 'daily') {
      // 本日の始まり
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'weekly') {
      // 今週の始まり（日曜日）
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
    } else if (period === 'monthly') {
      // 今月の始まり
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
    }
    
    // 期間に応じたレコードでユーザーを集計
    let users;
    
    if (period) {
      // 特定期間のレコードに基づいたランキング
      const aggregationResult = await User.aggregate([
        { $unwind: '$records' },
        { $match: { 'records.date': dateFilter.createdAt } },
        { $group: { 
          _id: '$_id', 
          username: { $first: '$username' },
          avatar: { $first: '$avatar' },
          grade: { $first: '$grade' },
          totalScore: { $sum: '$records.score' }
        }},
        { $sort: { totalScore: -1 } },
        { $limit: userLimit }
      ]);
      
      users = aggregationResult;
    } else {
      // 全期間の総合ポイント
      users = await User.find({}, 'username avatar grade points streak')
        .sort({ points: -1 })
        .limit(userLimit);
    }
    
    res.json({
      success: true,
      users
    });
  } catch (error) {
    logger.error('ランキング取得エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

export default {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  getTopUsers
};
