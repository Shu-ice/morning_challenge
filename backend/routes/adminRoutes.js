const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { 
    generateProblemsByAdmin, 
    getProblemsForAdmin,      // インポート
    updateProblemByAdmin,     // インポート
    getDashboardData         // 新しく追加
} = require('../controllers/adminController');

// 全ての管理者ルートに認証と管理者チェックを適用
router.use(protect, admin);

// 指定条件で問題を生成・保存 (POST /api/admin/problems/generate)
router.post('/problems/generate', generateProblemsByAdmin);

// 問題リスト取得 (GET /api/admin/problems?date=...&difficulty=...)
router.get('/problems', getProblemsForAdmin);

// 特定の問題を更新 (PUT /api/admin/problems/:id)
router.put('/problems/:id', updateProblemByAdmin);

// 管理者用ダッシュボード情報取得
router.get('/dashboard', getDashboardData);

module.exports = router; 