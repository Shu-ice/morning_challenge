import express from 'express';
import { getProblems, submitAnswers, getHistory, getProblemSetForEdit, generateProblemSet, saveEditedProblems, getGenerationStatus } from '../controllers/problemController.js';
import { protect, admin, timeRestriction } from '../middleware/authMiddleware.js';
import { 
  validateGetProblems, 
  validateSubmitResult, 
  validateRequestSize,
  sanitizeInput 
} from '../middleware/validationMiddleware.js';
import { 
  problemApiLimiter, 
  submitResultLimiter, 
  adminApiLimiter,
  skipLimitForAdmin 
} from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// 全体に適用するミドルウェア
router.use(validateRequestSize);
router.use(sanitizeInput);

// 問題取得ルート（時間制限あり）
router.get('/', problemApiLimiter, protect, timeRestriction, validateGetProblems, getProblems);

// 問題生成ルート (管理者専用)
router.post('/generate', adminApiLimiter, protect, admin, generateProblemSet);

// 問題生成進捗確認ルート (管理者専用)
router.get('/status/:requestId', adminApiLimiter, protect, admin, getGenerationStatus);

// 問題編集用取得ルート (管理者専用)
router.get('/edit', adminApiLimiter, protect, admin, validateGetProblems, getProblemSetForEdit);

// 問題編集保存ルート (管理者専用)
router.post('/edit', adminApiLimiter, protect, admin, saveEditedProblems);

// 問題回答提出ルート
router.post('/submit', submitResultLimiter, protect, timeRestriction, validateSubmitResult, submitAnswers);

// 新エンドポイント: /api/problems (POST) でも回答提出を受け付け
router.post('/', submitResultLimiter, protect, timeRestriction, validateSubmitResult, submitAnswers);

// 履歴取得ルート
router.get('/history', skipLimitForAdmin, protect, getHistory);

export default router;
