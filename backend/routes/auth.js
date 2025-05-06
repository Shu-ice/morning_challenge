const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
  setAdmin
} = require('../controllers/authController');

// 公開ルート
router.post('/register', register);
router.post('/login', login);

// 保護されたルート
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/update-password', protect, updatePassword);

// 管理者権限設定（開発環境専用）
router.post('/set-admin', protect, setAdmin);

module.exports = router; 