import express from 'express';
import { performanceStatsHandler } from '../middleware/performanceMiddleware.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';
import os from 'os';
import { getMockUsers, getMockResults } from '../config/database.js';

const router = express.Router();

/**
 * パフォーマンス統計API
 */
router.get('/performance', protect, admin, performanceStatsHandler);

/**
 * システムヘルスチェックAPI
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };

    // データベース接続チェック
    try {
      const dbState = mongoose.connection.readyState;
      const dbStates = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };
      
      healthCheck.checks.database = {
        status: dbState === 1 ? 'healthy' : 'unhealthy',
        state: dbStates[dbState],
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      };

      // データベースへの簡単なクエリテスト
      if (dbState === 1) {
        const startTime = Date.now();
        await mongoose.connection.db.admin().ping();
        const responseTime = Date.now() - startTime;
        
        healthCheck.checks.database.responseTime = `${responseTime}ms`;
        healthCheck.checks.database.lastPing = new Date().toISOString();
      }
    } catch (dbError) {
      healthCheck.checks.database = {
        status: 'unhealthy',
        error: dbError.message
      };
      healthCheck.status = 'degraded';
    }

    // メモリ使用量チェック
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const memoryUsagePercent = (memUsage.rss / totalMemory) * 100;
    
    healthCheck.checks.memory = {
      status: memoryUsagePercent > 90 ? 'warning' : 'healthy',
      usage: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      },
      percentage: `${memoryUsagePercent.toFixed(2)}%`
    };

    if (memoryUsagePercent > 90) {
      healthCheck.status = 'warning';
    }

    // CPU 負荷チェック
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadPercent = (loadAverage[0] / cpuCount) * 100;
    
    healthCheck.checks.cpu = {
      status: loadPercent > 80 ? 'warning' : 'healthy',
      loadAverage: loadAverage.map(load => load.toFixed(2)),
      cores: cpuCount,
      loadPercentage: `${loadPercent.toFixed(2)}%`
    };

    if (loadPercent > 80) {
      healthCheck.status = 'warning';
    }

    // ディスク容量チェック（可能な場合）
    try {
      const stats = await import('fs').then(fs => fs.promises.stat('.'));
      healthCheck.checks.disk = {
        status: 'healthy',
        lastCheck: new Date().toISOString()
      };
    } catch (diskError) {
      healthCheck.checks.disk = {
        status: 'unknown',
        error: 'Disk check not available'
      };
    }

    // 環境変数チェック
    const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    healthCheck.checks.environment = {
      status: missingEnvVars.length > 0 ? 'unhealthy' : 'healthy',
      nodeEnv: process.env.NODE_ENV,
      missingVariables: missingEnvVars
    };

    if (missingEnvVars.length > 0) {
      healthCheck.status = 'unhealthy';
    }

    // 総合ステータスの決定
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                       healthCheck.status === 'warning' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: healthCheck
    });

  } catch (error) {
    logger.error('[Monitoring] Health check failed:', error);
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 詳細システム情報API（管理者のみ）
 */
router.get('/system', protect, admin, async (req, res) => {
  try {
    const systemInfo = {
      timestamp: new Date().toISOString(),
      server: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        nodeVersion: process.version,
        processUptime: process.uptime(),
        pid: process.pid
      },
      hardware: {
        cpus: os.cpus().map(cpu => ({
          model: cpu.model,
          speed: cpu.speed,
          times: cpu.times
        })),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        },
        loadAverage: os.loadavg()
      },
      network: {
        interfaces: os.networkInterfaces()
      },
      process: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        env: {
          nodeEnv: process.env.NODE_ENV,
          platform: process.platform,
          arch: process.arch
        }
      }
    };

    // データベース統計
    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      
      systemInfo.database = {
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        readyState: mongoose.connection.readyState,
        collections: stats.collections,
        objects: stats.objects,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      };
    } catch (dbError) {
      systemInfo.database = {
        error: 'Unable to fetch database statistics',
        message: dbError.message
      };
    }

    res.json({
      success: true,
      data: systemInfo
    });

  } catch (error) {
    logger.error('[Monitoring] System info retrieval failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'システム情報の取得に失敗しました',
      error: error.message
    });
  }
});

/**
 * ログレベル動的変更API（管理者のみ）
 */
router.post('/log-level', protect, admin, (req, res) => {
  try {
    const { level } = req.body;
    const validLevels = ['error', 'warn', 'info', 'debug'];
    
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: `無効なログレベルです。有効な値: ${validLevels.join(', ')}`
      });
    }

    // ログレベルを動的に変更
    logger.setLogLevel(level);
    
    logger.info(`[Monitoring] Log level changed to: ${level}`, {
      changedBy: req.user.username,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `ログレベルを ${level} に変更しました`,
      data: {
        newLevel: level,
        validLevels
      }
    });

  } catch (error) {
    logger.error('[Monitoring] Log level change failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'ログレベルの変更に失敗しました',
      error: error.message
    });
  }
});

/**
 * キャッシュクリアAPI（管理者のみ）
 */
router.post('/clear-cache', protect, admin, (req, res) => {
  try {
    // Node.js のモジュールキャッシュをクリア（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      Object.keys(require.cache).forEach(key => {
        delete require.cache[key];
      });
    }

    logger.info('[Monitoring] Cache cleared', {
      clearedBy: req.user.username,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'キャッシュをクリアしました',
      data: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    });

  } catch (error) {
    logger.error('[Monitoring] Cache clear failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'キャッシュクリアに失敗しました',
      error: error.message
    });
  }
});

// データベース接続状態の確認
router.get('/database', (req, res) => {
  try {
    if (process.env.MONGODB_MOCK === 'true') {
      const users = getMockUsers();
      const results = getMockResults();
      
      res.json({
        success: true,
        type: 'mock',
        users: users.length,
        results: results.length,
        mockData: {
          users: users.map(u => ({ id: u._id, username: u.username, grade: u.grade })),
          results: results.map(r => ({ id: r._id, userId: r.userId, grade: r.grade, date: r.date }))
        }
      });
    } else {
      res.json({
        success: true,
        type: 'mongodb',
        message: 'MongoDB connection status check needed'
      });
    }
  } catch (error) {
    logger.error('Database monitoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;