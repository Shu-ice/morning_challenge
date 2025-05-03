const express = require('express');
const { generateProblems, getProblem, checkAnswer, getPracticeProblems } = require('../controllers/problemController');
const { protect, checkTimeWindow } = require('../middleware/authMiddleware');

const router = express.Router();

// 全てのルートに認証を適用
router.use(protect);

// 問題を生成して取得（時間帯チェック付き）
router.get('/generate/:grade', checkTimeWindow, generateProblems);

// 問題の詳細を取得
router.get('/:id', getProblem);

// 問題の答えを検証
router.post('/check/:id', checkAnswer);

// 練習用の問題を取得（時間帯チェックなし）
router.get('/practice/:grade', getPracticeProblems);

module.exports = router;