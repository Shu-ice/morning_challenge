import express from 'express';
import { getProblems, submitAnswers, getHistory, getProblemSetForEdit, generateProblemSet, saveEditedProblems, getGenerationStatus } from '../controllers/problemController.js';
import { protect, admin, timeRestriction } from '../middleware/authMiddleware.js';

const router = express.Router();

// 問題取得ルート（時間制限あり）
router.get('/', protect, timeRestriction, getProblems);

// 問題生成ルート (管理者専用)
router.post('/generate', protect, admin, generateProblemSet);

// 問題生成進捗確認ルート (管理者専用)
router.get('/status/:requestId', protect, admin, getGenerationStatus);

// 問題編集用取得ルート (管理者専用)
router.get('/edit', protect, admin, getProblemSetForEdit);

// 問題編集保存ルート (管理者専用)
router.post('/edit', protect, admin, saveEditedProblems);

// 問題回答提出ルート
router.post('/submit', protect, timeRestriction, submitAnswers);

// 履歴取得ルート
router.get('/history', protect, getHistory);

export default router;
