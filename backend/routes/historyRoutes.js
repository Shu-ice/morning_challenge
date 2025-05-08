import express from 'express';
import { getUserHistory, getHistoryDetail } from '../controllers/historyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// 全てのルートに認証を適用
router.use(protect);

// ユーザーの履歴を取得 - 時間制限なし（いつでも閲覧可能）
router.get('/', getUserHistory);

// 履歴の詳細を取得 - 時間制限なし（いつでも閲覧可能）
router.get('/:id', getHistoryDetail);

export default router; 