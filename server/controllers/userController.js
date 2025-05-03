const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

// トークン生成関数
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'morningmathsecret', {
    expiresIn: '30d'
  });
};

// @desc    ユーザー登録
// @route   POST /api/users/register
// @access  Public
exports.registerUser = async (req, res) => {
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
    console.error('ユーザー登録エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザーログイン
// @route   POST /api/users/login
// @access  Public
exports.loginUser = async (req, res) => {
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
    console.error('ログインエラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザープロフィールの取得
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
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
    console.error('プロファイル取得エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザープロフィールの更新
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { grade, avatar } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false, 
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 更新するフィールドをセット
    if (grade) user.grade = parseInt(grade);
    if (avatar) user.avatar = avatar;
    
    const updatedUser = await user.save();
    
    res.json({
      success: true,
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        grade: updatedUser.grade,
        avatar: updatedUser.avatar,
        points: updatedUser.points,
        streak: updatedUser.streak
      }
    });
  } catch (error) {
    console.error('プロファイル更新エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    ユーザーのアイテム購入
// @route   POST /api/users/purchase
// @access  Private
exports.purchaseItem = async (req, res) => {
  try {
    const { itemId } = req.body;
    const user = await User.findById(req.user._id);
    const Item = require('../models/itemModel');
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
exports.logoutUser = (req, res) => {
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
    console.error('ログアウトエラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

// @desc    トップユーザーの取得（ランキング用）
// @route   GET /api/users/top
// @access  Public
exports.getTopUsers = async (req, res) => {
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
    console.error('ランキング取得エラー:', error);
    res.status(500).json({
      success: false, 
      message: 'サーバーエラーが発生しました'
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  getTopUsers
};
