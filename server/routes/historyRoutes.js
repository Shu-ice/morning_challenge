import express from 'express';
import { getHistory } from '../controllers/problemController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    ユーザーの履歴取得
// @route   GET /api/history
// @access  Private
router.get('/', protect, getHistory);

export default router; 