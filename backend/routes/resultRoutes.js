import express from 'express';
import { saveResult, getUserResults, getResultDetail, getTodayResult } from '../controllers/resultController.js';
import { protect, checkTimeWindow } from '../middleware/authMiddleware.js';

const router = express.Router();

// 全てのルートに認証を適用
router.use(protect);

// 今日の結果を確認
router.get('/today', getTodayResult);

// 結果を保存（時間帯チェック付き）
router.post('/', checkTimeWindow, saveResult);

// ユーザーの結果履歴を取得
router.get('/', getUserResults);

// 結果の詳細を取得
router.get('/:id', getResultDetail);

export default router;