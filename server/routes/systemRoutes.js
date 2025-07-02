import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { checkSystemHealth, generateHealthSummary } from '../utils/healthCheck.js';
import { errorStats } from '../utils/errorHandler.js';
import { getTodayJST, getJSTTimeInfo } from '../utils/dateUtils.js';
import { logger } from '../utils/logger.js';
import { 
  validateDateRange,
  validateRequestSize,
  sanitizeInput 
} from '../middleware/validationMiddleware.js';
import { adminApiLimiter } from '../middleware/rateLimitMiddleware.js';
import os from 'os';
import process from 'process';

const router = express.Router();

// Apply security middleware
router.use(validateRequestSize);
router.use(sanitizeInput);
router.use(adminApiLimiter);

/**
 * システム全体の監視情報を提供するエンドポイント
 */
router.get('/status', protect, admin, async (req, res) => {
  try {
    logger.info('[SystemMonitor] システム状態チェック開始');
    
    const startTime = Date.now();
    
    // システムヘルスチェック実行
    const healthCheck = await checkSystemHealth();
    
    // システム情報収集
    const systemInfo = {
      // Node.js プロセス情報
      process: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        pid: process.pid,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      
      // OS情報
      system: {
        hostname: os.hostname(),
        type: os.type(),
        release: os.release(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        cpus: os.cpus().length
      },
      
      // 時間情報
      time: {
        ...getJSTTimeInfo(),
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        uptimeHours: Math.floor(process.uptime() / 3600)
      },
      
      // 環境情報
      environment: {
        nodeEnv: process.env.NODE_ENV,
        mongoMock: process.env.MONGODB_MOCK === 'true',
        timeCheckDisabled: process.env.DISABLE_TIME_CHECK === 'true',
        frontendUrl: process.env.FRONTEND_URL,
        vercelEnv: process.env.VERCEL_ENV
      }
    };
    
    // エラー統計
    const errorStatistics = errorStats.getStats();
    
    // パフォーマンス指標
    const performanceMetrics = {
      responseTime: Date.now() - startTime,
      memoryUsage: {
        used: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        total: process.memoryUsage().heapTotal / 1024 / 1024, // MB
        external: process.memoryUsage().external / 1024 / 1024 // MB
      },
      cpuUsage: process.cpuUsage()
    };
    
    // 総合評価
    const overallStatus = {
      isHealthy: healthCheck.isHealthy && errorStatistics.recentCount < 10,
      statusLevel: getStatusLevel(healthCheck, errorStatistics),
      summary: generateHealthSummary(healthCheck),
      recommendations: generateRecommendations(healthCheck, errorStatistics, systemInfo)
    };
    
    logger.info(`[SystemMonitor] システム状態チェック完了: ${overallStatus.statusLevel}`);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: overallStatus,
      health: healthCheck,
      system: systemInfo,
      errors: errorStatistics,
      performance: performanceMetrics,
      checkDuration: Date.now() - startTime
    });
    
  } catch (error) {
    logger.error('[SystemMonitor] システム状態チェックエラー:', error);
    res.status(500).json({
      success: false,
      message: 'システム状態の取得中にエラーが発生しました',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 軽量なシステムヘルスチェック（外部監視用）
 */
router.get('/health', async (req, res) => {
  try {
    const isBasicHealthy = process.uptime() > 0 && process.memoryUsage().heapUsed > 0;
    
    if (isBasicHealthy) {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * エラー統計のリセット（管理者専用）
 */
router.post('/errors/reset', protect, admin, (req, res) => {
  try {
    errorStats.reset();
    logger.info('[SystemMonitor] エラー統計をリセットしました');
    
    res.json({
      success: true,
      message: 'エラー統計をリセットしました',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[SystemMonitor] エラー統計リセットエラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラー統計のリセット中にエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * システムメンテナンス情報
 */
router.get('/maintenance', protect, admin, (req, res) => {
  try {
    const maintenanceInfo = {
      scheduledMaintenance: false,
      lastMaintenance: null,
      nextMaintenance: null,
      maintenanceWindow: '毎日 03:00-04:00 JST',
      backupStatus: {
        lastBackup: null,
        nextBackup: null,
        backupLocation: 'MongoDB Atlas自動バックアップ'
      },
      emergencyContacts: [
        'システム管理者: admin@example.com'
      ]
    };
    
    res.json({
      success: true,
      maintenance: maintenanceInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'メンテナンス情報の取得中にエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * ステータスレベルの決定
 */
function getStatusLevel(healthCheck, errorStats) {
  if (!healthCheck.isHealthy) {
    return 'critical';
  }
  
  if (errorStats.recentCount > 10) {
    return 'warning';
  }
  
  if (errorStats.recentCount > 5) {
    return 'caution';
  }
  
  return 'normal';
}

/**
 * 推奨事項の生成
 */
function generateRecommendations(healthCheck, errorStats, systemInfo) {
  const recommendations = [];
  
  // ヘルスチェックに基づく推奨事項
  if (!healthCheck.isHealthy) {
    recommendations.push({
      priority: 'high',
      category: 'system',
      message: 'システムに重要な問題があります。詳細を確認してください。',
      action: 'ヘルスチェック結果を確認し、問題のあるコンポーネントを修正してください'
    });
  }
  
  // エラー統計に基づく推奨事項
  if (errorStats.recentCount > 10) {
    recommendations.push({
      priority: 'medium',
      category: 'errors',
      message: '直近1時間でエラーが多発しています',
      action: 'エラーログを確認し、根本原因を調査してください'
    });
  }
  
  // メモリ使用量に基づく推奨事項
  const memoryUsagePercent = (systemInfo.process.memory.heapUsed / systemInfo.process.memory.heapTotal) * 100;
  if (memoryUsagePercent > 85) {
    recommendations.push({
      priority: 'medium',
      category: 'performance',
      message: 'メモリ使用量が高くなっています',
      action: 'メモリリークの可能性を調査し、不要なデータを解放してください'
    });
  }
  
  // アップタイムに基づく推奨事項
  if (systemInfo.time.uptimeHours < 1) {
    recommendations.push({
      priority: 'low',
      category: 'info',
      message: 'システムが最近再起動されました',
      action: '正常な再起動であることを確認してください'
    });
  }
  
  return recommendations;
}

export default router;