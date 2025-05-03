const express = require('express');
const { check } = require('express-validator');
const { register, login, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// ユーザー登録
router.post(
  '/register',
  [
    check('username', 'ユーザー名は3文字以上20文字以下で入力してください').isLength({ min: 3, max: 20 }),
    check('email', '有効なメールアドレスを入力してください').isEmail(),
    check('password', 'パスワードは6文字以上で入力してください').isLength({ min: 6 }),
    check('grade', '学年は1-6の範囲で入力してください').isInt({ min: 1, max: 6 })
  ],
  register
);

// ログイン
router.post('/login', login);

// 自分のプロフィール取得
router.get('/me', protect, getMe);

// プロフィール更新
router.put('/profile', protect, updateProfile);

module.exports = router;