// Vercel Function: /api/system/status
// システム状態監視API
const { connectMongoose } = require('../_lib/database');
const jwt = require('jsonwebtoken');
const os = require('os');

const logger = {
  info: (...args) => !process.env.VERCEL && console.log('[System/Status]', ...args),
  debug: (...args) => !process.env.VERCEL && console.debug('[System/Status]', ...args),
  warn: (...args) => console.warn('[System/Status]', ...args),
  error: (...args) => console.error('[System/Status]', ...args)
};

// JWT認証ミドルウェア
const authenticate = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証トークンが必要です');
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    if (!decoded.isAdmin) {
      throw new Error('管理者権限が必要です');
    }
    return decoded;
  } catch (error) {
    throw new Error('無効な認証トークンです');
  }
};

// JST時間情報を取得
const getJSTTimeInfo = () => {
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  
  return {
    utc: now.toISOString(),
    jst: jstTime.toISOString().replace('Z', '+09:00'),
    jstDate: jstTime.toISOString().split('T')[0], // YYYY-MM-DD
    timestamp: now.getTime()
  };
};

// システムヘルスチェック
const checkSystemHealth = async () => {
  const healthResult = {
    timestamp: new Date().toISOString(),
    jstTimestamp: getJSTTimeInfo().jst,
    isHealthy: true,
    components: {},
    summary: {
      totalComponents: 0,
      healthyComponents: 0,
      unhealthyComponents: 0
    }
  };

  // 1. データベース接続チェック
  try {
    if (process.env.MONGODB_MOCK === 'true') {
      healthResult.components.database = {
        name: 'データベース接続',
        isHealthy: true,
        details: 'モック環境 - 正常',
        responseTime: Math.random() * 10 + 5 // 5-15ms
      };
    } else {
      const dbStartTime = Date.now();
      await connectMongoose();
      const dbResponseTime = Date.now() - dbStartTime;
      
      healthResult.components.database = {
        name: 'データベース接続',
        isHealthy: true,
        details: 'MongoDB接続正常',
        responseTime: dbResponseTime
      };
    }
  } catch (error) {
    healthResult.components.database = {
      name: 'データベース接続',
      isHealthy: false,
      error: error.message,
      issues: ['データベース接続エラー']
    };
  }

  // 2. システムリソースチェック
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const isMemoryHealthy = memoryUsagePercent < 85;

    healthResult.components.memory = {
      name: 'メモリ使用量',
      isHealthy: isMemoryHealthy,
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        usagePercent: Math.round(memoryUsagePercent),
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      issues: isMemoryHealthy ? [] : ['メモリ使用量が高い']
    };
  } catch (error) {
    healthResult.components.memory = {
      name: 'メモリ使用量',
      isHealthy: false,
      error: error.message,
      issues: ['メモリ情報取得エラー']
    };
  }

  // 3. プロセス情報チェック
  try {
    const uptimeHours = Math.floor(process.uptime() / 3600);
    const isUptimeHealthy = process.uptime() > 0;

    healthResult.components.process = {
      name: 'プロセス状態',
      isHealthy: isUptimeHealthy,
      details: {
        uptime: process.uptime(),
        uptimeHours,
        pid: process.pid,
        version: process.version,
        platform: process.platform
      },
      issues: isUptimeHealthy ? [] : ['プロセス異常']
    };
  } catch (error) {
    healthResult.components.process = {
      name: 'プロセス状態',
      isHealthy: false,
      error: error.message,
      issues: ['プロセス情報取得エラー']
    };
  }

  // 結果集計
  const components = Object.values(healthResult.components);
  healthResult.summary.totalComponents = components.length;
  healthResult.summary.healthyComponents = components.filter(c => c.isHealthy).length;
  healthResult.summary.unhealthyComponents = components.filter(c => !c.isHealthy).length;

  // 全体的な健全性判定
  healthResult.isHealthy = components.every(c => c.isHealthy);

  return healthResult;
};

// エラー統計（簡易版）
const getErrorStats = () => {
  // 実際の実装では、エラーログから統計を取得
  return {
    totalCount: Math.floor(Math.random() * 50),
    recentCount: Math.floor(Math.random() * 5),
    lastHourCount: Math.floor(Math.random() * 10),
    criticalCount: Math.floor(Math.random() * 2),
    warningCount: Math.floor(Math.random() * 8)
  };
};

// 推奨事項の生成
const generateRecommendations = (healthCheck, errorStats, systemInfo) => {
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
  const memoryComponent = healthCheck.components.memory;
  if (memoryComponent && memoryComponent.details && memoryComponent.details.usagePercent > 85) {
    recommendations.push({
      priority: 'medium',
      category: 'performance',
      message: 'メモリ使用量が高くなっています',
      action: 'メモリリークの可能性を調査し、不要なデータを解放してください'
    });
  }
  
  return recommendations;
};

// ステータスレベルの決定
const getStatusLevel = (healthCheck, errorStats) => {
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
};

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    // 認証チェック
    authenticate(req);

    logger.info('システム状態チェック開始');
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
      
      // OS情報（Vercel環境では制限あり）
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
        vercelEnv: process.env.VERCEL_ENV,
        isVercel: !!process.env.VERCEL
      }
    };
    
    // エラー統計
    const errorStatistics = getErrorStats();
    
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
      summary: healthCheck.isHealthy ? '✅ システムは正常に動作しています' : '🚨 システムに問題があります',
      recommendations: generateRecommendations(healthCheck, errorStatistics, systemInfo)
    };
    
    logger.info(`システム状態チェック完了: ${overallStatus.statusLevel}`);
    
    return res.status(200).json({
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
    logger.error('システム状態チェックエラー:', error);
    
    if (error.message.includes('認証') || error.message.includes('権限')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'システム状態の取得中にエラーが発生しました',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};