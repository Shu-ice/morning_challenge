const express = require('express');
const {
  // generateProblems, // 古い関数はコメントアウトまたは削除
  getProblem,
  checkAnswer,
  getPracticeProblems,
  getProblemsByDifficulty,
  generateAndSaveProblems, // 新しい関数をインポート
  getGenerationStatus
} = require('../controllers/problemController');
const { protect, checkTimeWindow } = require('../middleware/authMiddleware'); 

const router = express.Router();

// 全てのルートに認証を適用
router.use(protect);

// 難易度に基づいて問題を取得 (GET /api/problems?difficulty=...&date=...)
// 時間制限チェックを適用
router.get('/', checkTimeWindow, getProblemsByDifficulty);

// 指定条件で問題を生成してDBに保存 (POST /api/problems/generate)
router.post('/generate', generateAndSaveProblems);

// 問題生成の進捗状況を取得 (GET /api/problems/status/:requestId)
router.get('/status/:requestId', getGenerationStatus);

// 問題の詳細を取得 (GET /api/problems/:id)
router.get('/:id', getProblem);

// 問題の答えを検証 (POST /api/problems/check/:id)
// 時間制限チェックを適用
router.post('/check/:id', checkTimeWindow, checkAnswer);

// 練習用の問題を取得（時間帯チェックなし）(GET /api/problems/practice/:grade)
router.get('/practice/:grade', getPracticeProblems);

module.exports = router;