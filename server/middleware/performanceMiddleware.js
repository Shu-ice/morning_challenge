import { logger } from '../utils/logger.js';

/**
 * API Performance Monitoring Middleware
 * レスポンス時間、リクエスト数、エラー率を監視
 */

// パフォーマンス統計の保存
const performanceStats = {
  requests: new Map(), // endpoint別のリクエスト統計
  slowQueries: [], // 遅いリクエストの記録
  errorRates: new Map(), // endpoint別のエラー率
  globalStats: {
    totalRequests: 0,
    totalErrors: 0,
    averageResponseTime: 0,
    requestsPerMinute: 0
  }
};

// 統計をリセットする時間間隔（分）
const STATS_RESET_INTERVAL = 60;

// 遅いリクエストの閾値（ミリ秒）
const SLOW_REQUEST_THRESHOLD = 1000;

// 統計の最大保持数
const MAX_SLOW_QUERIES = 100;

/**
 * パフォーマンス監視ミドルウェア
 */
export const performanceMonitor = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  req.startTime = startTime;

  // レスポンス完了時の処理
  const originalSend = res.send;
  res.send = function(data) {
    const endTime = process.hrtime.bigint();
    const responseTimeMs = Number(endTime - startTime) / 1_000_000; // ナノ秒からミリ秒に変換
    
    // 統計情報を更新
    updatePerformanceStats(req, res, responseTimeMs);
    
    // パフォーマンスログ
    logPerformanceMetrics(req, res, responseTimeMs, requestId);
    
    // 遅いリクエストの記録
    if (responseTimeMs > SLOW_REQUEST_THRESHOLD) {
      recordSlowQuery(req, res, responseTimeMs, requestId);
    }
    
    return originalSend.call(this, data);
  };

  next();
};

/**
 * 統計情報の更新
 */
const updatePerformanceStats = (req, res, responseTimeMs) => {
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  const isError = res.statusCode >= 400;

  // グローバル統計の更新
  performanceStats.globalStats.totalRequests++;
  if (isError) {
    performanceStats.globalStats.totalErrors++;
  }

  // 平均レスポンス時間の更新（移動平均）
  const currentAvg = performanceStats.globalStats.averageResponseTime;
  const totalRequests = performanceStats.globalStats.totalRequests;
  performanceStats.globalStats.averageResponseTime = 
    (currentAvg * (totalRequests - 1) + responseTimeMs) / totalRequests;

  // エンドポイント別統計の更新
  if (!performanceStats.requests.has(endpoint)) {
    performanceStats.requests.set(endpoint, {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errors: 0,
      lastRequest: new Date()
    });
  }

  const endpointStats = performanceStats.requests.get(endpoint);
  endpointStats.count++;
  endpointStats.totalTime += responseTimeMs;
  endpointStats.averageTime = endpointStats.totalTime / endpointStats.count;
  endpointStats.minTime = Math.min(endpointStats.minTime, responseTimeMs);
  endpointStats.maxTime = Math.max(endpointStats.maxTime, responseTimeMs);
  endpointStats.lastRequest = new Date();
  
  if (isError) {
    endpointStats.errors++;
  }

  // エラー率の計算
  const errorRate = (endpointStats.errors / endpointStats.count) * 100;
  performanceStats.errorRates.set(endpoint, errorRate);
};

/**
 * パフォーマンスメトリクスのログ出力
 */
const logPerformanceMetrics = (req, res, responseTimeMs, requestId) => {
  const logLevel = responseTimeMs > SLOW_REQUEST_THRESHOLD ? 'warn' : 'debug';
  
  logger[logLevel]('[Performance]', {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime: `${responseTimeMs.toFixed(2)}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
};

/**
 * 遅いクエリの記録
 */
const recordSlowQuery = (req, res, responseTimeMs, requestId) => {
  const slowQuery = {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.method === 'POST' ? sanitizeBody(req.body) : undefined,
    responseTime: responseTimeMs,
    statusCode: res.statusCode,
    timestamp: new Date(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  };

  performanceStats.slowQueries.push(slowQuery);

  // 最大保持数を超えた場合は古いものを削除
  if (performanceStats.slowQueries.length > MAX_SLOW_QUERIES) {
    performanceStats.slowQueries.shift();
  }

  logger.warn('[Performance] Slow request detected', slowQuery);
};

/**
 * リクエストボディの機密情報を除去
 */
const sanitizeBody = (body) => {
  if (!body) return undefined;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

/**
 * パフォーマンス統計の取得
 */
export const getPerformanceStats = () => {
  const now = new Date();
  
  // エンドポイント別統計を配列に変換
  const endpointStats = Array.from(performanceStats.requests.entries()).map(([endpoint, stats]) => ({
    endpoint,
    ...stats,
    errorRate: performanceStats.errorRates.get(endpoint) || 0
  }));

  // パフォーマンスの悪いエンドポイントをソート
  const slowestEndpoints = endpointStats
    .sort((a, b) => b.averageTime - a.averageTime)
    .slice(0, 10);

  const highErrorEndpoints = endpointStats
    .filter(stat => stat.errorRate > 5) // 5%以上のエラー率
    .sort((a, b) => b.errorRate - a.errorRate);

  return {
    timestamp: now.toISOString(),
    global: performanceStats.globalStats,
    endpoints: endpointStats,
    slowestEndpoints,
    highErrorEndpoints,
    recentSlowQueries: performanceStats.slowQueries.slice(-20), // 最新20件
    summary: {
      totalEndpoints: endpointStats.length,
      averageErrorRate: calculateAverageErrorRate(endpointStats),
      requestsInLastMinute: calculateRequestsPerMinute(),
      healthScore: calculateHealthScore(endpointStats)
    }
  };
};

/**
 * 平均エラー率の計算
 */
const calculateAverageErrorRate = (endpointStats) => {
  if (endpointStats.length === 0) return 0;
  
  const totalErrorRate = endpointStats.reduce((sum, stat) => sum + stat.errorRate, 0);
  return totalErrorRate / endpointStats.length;
};

/**
 * 1分あたりのリクエスト数を計算
 */
const calculateRequestsPerMinute = () => {
  const oneMinuteAgo = new Date(Date.now() - 60000);
  
  let requestsInLastMinute = 0;
  for (const [, stats] of performanceStats.requests) {
    if (stats.lastRequest >= oneMinuteAgo) {
      requestsInLastMinute += stats.count;
    }
  }
  
  return requestsInLastMinute;
};

/**
 * システムヘルスコアの計算（0-100）
 */
const calculateHealthScore = (endpointStats) => {
  if (endpointStats.length === 0) return 100;
  
  const avgResponseTime = performanceStats.globalStats.averageResponseTime;
  const avgErrorRate = calculateAverageErrorRate(endpointStats);
  
  // レスポンス時間によるスコア（0-50）
  const responseTimeScore = Math.max(0, 50 - (avgResponseTime / 20));
  
  // エラー率によるスコア（0-50）
  const errorRateScore = Math.max(0, 50 - (avgErrorRate * 2));
  
  return Math.round(responseTimeScore + errorRateScore);
};

/**
 * 統計のリセット（定期実行用）
 */
export const resetPerformanceStats = () => {
  logger.info('[Performance] Resetting performance statistics');
  
  performanceStats.requests.clear();
  performanceStats.errorRates.clear();
  performanceStats.slowQueries.length = 0;
  performanceStats.globalStats = {
    totalRequests: 0,
    totalErrors: 0,
    averageResponseTime: 0,
    requestsPerMinute: 0
  };
};

/**
 * 定期的な統計リセットの開始
 */
export const startPerformanceMonitoring = () => {
  logger.info('[Performance] Starting performance monitoring');
  
  // 定期的な統計リセット
  setInterval(() => {
    resetPerformanceStats();
  }, STATS_RESET_INTERVAL * 60 * 1000);
  
  // メモリ使用量の監視
  setInterval(() => {
    const memUsage = process.memoryUsage();
    logger.debug('[Performance] Memory usage', {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    });
  }, 5 * 60 * 1000); // 5分ごと
};

/**
 * API統計エンドポイント用のルートハンドラー
 */
export const performanceStatsHandler = (req, res) => {
  try {
    const stats = getPerformanceStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('[Performance] Error getting performance stats:', error);
    res.status(500).json({
      success: false,
      message: 'パフォーマンス統計の取得に失敗しました'
    });
  }
};