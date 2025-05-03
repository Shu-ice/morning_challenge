const express = require('express');
const router = express.Router();
const { getProblems, submitAnswers, getHistory } = require('../controllers/problemController');
const { protect, timeRestriction } = require('../middleware/authMiddleware');

// 問題取得ルート（時間制限あり）
router.get('/', protect, getProblems);

// 問題回答提出ルート
router.post('/submit', protect, submitAnswers);

// 履歴取得ルート
router.get('/history', protect, getHistory);

module.exports = router;
