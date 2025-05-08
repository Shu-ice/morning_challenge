import express from 'express';
import { check } from 'express-validator';
import { register, login, getMe, updateProfile, updatePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ユーザー登録 - 時間制限なし
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

// ログイン - 時間制限なし
router.post('/login', login);

// 自分のプロフィール取得 - 認証は必要だが時間制限なし
router.get('/me', protect, getMe);

// プロフィール更新 - 認証は必要だが時間制限なし
router.put('/profile', protect, updateProfile);

// パスワード更新 - 認証は必要だが時間制限なし
router.put('/update-password', protect, updatePassword);

export default router;