import express from 'express';
import {
  // generateProblems, // 古い関数はコメントアウトまたは削除
  getProblem,
  checkAnswer,
  getPracticeProblems,
  getProblemsByDifficulty,
  generateAndSaveProblems, // インポートリストに追加
  getGenerationStatus, // getGenerationStatus をインポートリストに追加
  updateMultipleProblems, // ★ 新しいコントローラ関数をインポート
  // getGenerationStatus
  // submitUserAnswers       // 解答提出用 (problemControllerからインポート想定)
} from '../controllers/problemController.js'; // .js 拡張子を忘れずに
import { saveResult } from '../controllers/resultController.js'; // ★ saveResult をインポート
import { protect, checkTimeWindow } from '../middleware/authMiddleware.js'; // .js 拡張子を忘れずに

const router = express.Router();

// 全てのルートに認証を適用
router.use(protect);

// --- 具体的なパスを先に定義 ---

// 指定条件で問題を生成してDBに保存 (POST /api/problems/generate) - 管理者用
router.post('/generate', generateAndSaveProblems); // コメントアウトを解除

// 問題生成の進捗状況を取得 (GET /api/problems/status/:requestId)
router.get('/status/:requestId', getGenerationStatus); // コメントアウトを解除

// ユーザーの解答を一括で送信 (POST /api/problems/submit)
// 時間制限チェックと認証を適用
router.post('/submit', checkTimeWindow, saveResult); // ★ ハンドラを saveResult に変更

// 練習用の問題を取得（時間帯チェックなし）(GET /api/problems/practice/:grade)
router.get('/practice/:grade', getPracticeProblems);

// 問題の答えを検証 (POST /api/problems/check/:id)
// 時間制限チェックを適用
router.post('/check/:id', checkTimeWindow, checkAnswer);

// 問題編集用の問題リスト取得 (GET /api/problems/edit?difficulty=...&date=...)
router.get('/edit', getProblemsByDifficulty); // protectミドルウェアは既にrouter.use(protect)で適用されている

// ★ 問題編集リストを一括更新 (POST /api/problems/edit)
router.post('/edit', updateMultipleProblems);

// --- 汎用的なパスを後に定義 ---

// 難易度に基づいて問題を取得 (GET /api/problems?difficulty=...&date=...)
// 時間制限チェックを適用
router.get('/', checkTimeWindow, getProblemsByDifficulty);

// 問題の詳細を取得 (GET /api/problems/:id)
router.get('/:id', getProblem);

export default router;