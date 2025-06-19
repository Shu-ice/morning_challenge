import express from 'express';
import {
  getSystemOverview,
  getUsers,
  getDifficultyStats,
  getGradeStats,
  getHourlyStats,
  getProblemSetStats
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getTimeWindowConfig, updateTimeWindowConfig } from '../controllers/timeWindowController.js';

const router = express.Router();

// 全ての管理者ルートに認証・管理者権限チェックを適用
router.use(protect, admin);

// システム統計API
router.get('/stats/overview', getSystemOverview);
router.get('/stats/difficulty', getDifficultyStats);
router.get('/stats/grade', getGradeStats);
router.get('/stats/hourly', getHourlyStats);
router.get('/stats/problemsets', getProblemSetStats);

// 時間帯設定 API
router.get('/time-window', getTimeWindowConfig);
router.put('/time-window', updateTimeWindowConfig);

// ユーザー管理API
router.get('/users', getUsers);

export default router; 