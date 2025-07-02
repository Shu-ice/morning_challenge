import express from 'express';
import {
  getSystemOverview,
  getUsers,
  getDifficultyStats,
  getGradeStats,
  getHourlyStats,
  getProblemSetStats,
  makeUserAdmin,
  removeUserAdmin
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getTimeWindowConfig, updateTimeWindowConfig } from '../controllers/timeWindowController.js';
import { 
  checkSystemHealth, 
  checkDailyProblemsHealth, 
  checkAutoGenerationNeeded,
  generateHealthSummary 
} from '../utils/healthCheck.js';
import { logger } from '../utils/logger.js';
import { 
  validateAdminUserUpdate, 
  validateTimeWindow,
  validateDateRange,
  validateRequestSize,
  sanitizeInput 
} from '../middleware/validationMiddleware.js';
import { adminApiLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// 全ての管理者ルートに適用するミドルウェア
router.use(validateRequestSize);
router.use(sanitizeInput);
router.use(adminApiLimiter);
router.use(protect, admin);

// システム統計API
router.get('/stats/overview', validateDateRange, getSystemOverview);
router.get('/stats/difficulty', validateDateRange, getDifficultyStats);
router.get('/stats/grade', validateDateRange, getGradeStats);
router.get('/stats/hourly', validateDateRange, getHourlyStats);
router.get('/stats/problemsets', validateDateRange, getProblemSetStats);

// 時間帯設定 API
router.get('/time-window', getTimeWindowConfig);
router.put('/time-window', validateTimeWindow, updateTimeWindowConfig);

// ユーザー管理API
router.get('/users', validateDateRange, getUsers);
router.put('/users/:userId/make-admin', validateAdminUserUpdate, makeUserAdmin);
router.put('/users/:userId/remove-admin', validateAdminUserUpdate, removeUserAdmin);

// 🔧 新機能: ヘルスチェックAPI
router.get('/health/system', async (req, res) => {
  try {
    logger.info('[AdminRoutes] システムヘルスチェック実行');
    const healthResult = await checkSystemHealth();
    const summary = generateHealthSummary(healthResult);
    
    res.json({
      success: true,
      data: healthResult,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[AdminRoutes] システムヘルスチェックエラー:', error);
    res.status(500).json({
      success: false,
      message: 'ヘルスチェック実行中にエラーが発生しました',
      error: error.message
    });
  }
});

router.get('/health/problems/:date?', async (req, res) => {
  try {
    const targetDate = req.params.date || null;
    logger.info(`[AdminRoutes] 問題セットヘルスチェック実行: ${targetDate || '今日'}`);
    
    const healthResult = await checkDailyProblemsHealth(targetDate);
    const summary = generateHealthSummary(healthResult);
    
    res.json({
      success: true,
      data: healthResult,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[AdminRoutes] 問題セットヘルスチェックエラー:', error);
    res.status(500).json({
      success: false,
      message: '問題セットヘルスチェック実行中にエラーが発生しました',
      error: error.message
    });
  }
});

router.get('/health/auto-generation', async (req, res) => {
  try {
    logger.info('[AdminRoutes] 自動生成推奨チェック実行');
    const recommendation = await checkAutoGenerationNeeded();
    
    res.json({
      success: true,
      data: recommendation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[AdminRoutes] 自動生成推奨チェックエラー:', error);
    res.status(500).json({
      success: false,
      message: '自動生成推奨チェック実行中にエラーが発生しました',
      error: error.message
    });
  }
});

export default router; 