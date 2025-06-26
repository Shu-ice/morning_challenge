// Vercel Function: /api/monitoring
// MongoDB Atlas対応版統合監視API - ヘルスチェックとパフォーマンス統計を統合

const mongoose = require('mongoose');
const { connectMongoose } = require('./_lib/database');

// MongoDBスキーマ定義
const resultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String, required: true, index: true },
  grade: { type: Number, required: false, default: 0 },
  difficulty: { type: String, required: true, enum: ['beginner', 'intermediate', 'advanced', 'expert'], index: true },
  date: { type: String, required: true, index: true },
  totalProblems: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  timeSpent: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

// モデル定義
let Result;
try {
  Result = mongoose.model('Result');
} catch {
  Result = mongoose.model('Result', resultSchema);
}

async function getHealthCheck() {
  const startTime = Date.now();
  let overallStatus = 'healthy';
  const checks = {};

  // データベース接続チェック
  try {
    const dbStartTime = Date.now();
    await connectMongoose();
    await mongoose.connection.db.admin().ping();
    
    const dbResponseTime = Date.now() - dbStartTime;
    checks.database = {
      status: dbResponseTime < 1000 ? 'healthy' : dbResponseTime < 3000 ? 'warning' : 'unhealthy',
      responseTime: `${dbResponseTime}ms`,
      lastPing: new Date().toISOString()
    };

    if (checks.database.status !== 'healthy') {
      overallStatus = checks.database.status;
    }
  } catch (dbError) {
    checks.database = {
      status: 'unhealthy',
      error: dbError.message,
      lastPing: new Date().toISOString()
    };
    overallStatus = 'unhealthy';
  }

  // メモリ使用量チェック
  const memoryUsage = process.memoryUsage();
  const totalMemoryMB = memoryUsage.heapTotal / 1024 / 1024;
  const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024;
  const memoryUtilization = (usedMemoryMB / totalMemoryMB) * 100;

  checks.memory = {
    status: memoryUtilization < 70 ? 'healthy' : memoryUtilization < 85 ? 'warning' : 'unhealthy',
    usage: {
      total: Math.round(totalMemoryMB),
      used: Math.round(usedMemoryMB),
      free: Math.round(totalMemoryMB - usedMemoryMB),
      utilization: Math.round(memoryUtilization)
    },
    percentage: `${Math.round(memoryUtilization)}%`
  };

  if (checks.memory.status !== 'healthy' && overallStatus === 'healthy') {
    overallStatus = checks.memory.status;
  }

  // 環境変数チェック
  const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  checks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    missingVariables: missingEnvVars
  };

  if (checks.environment.status !== 'healthy') {
    overallStatus = 'unhealthy';
  }

  const system = {
    uptime: process.uptime(),
    memory: memoryUsage,
    cpu: process.cpuUsage(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version
  };

  return {
    timestamp: new Date().toISOString(),
    status: overallStatus,
    checks,
    system,
    responseTime: `${Date.now() - startTime}ms`
  };
}

async function getPerformanceStats() {
  const startTime = Date.now();
  
  const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    recentRequests,
    totalRequests,
    weeklyRequests,
    slowQueries
  ] = await Promise.all([
    Result.countDocuments({ createdAt: { $gte: past24Hours } }),
    Result.countDocuments({}),
    Result.aggregate([
      { $match: { createdAt: { $gte: pastWeek } } },
      {
        $group: {
          _id: null,
          averageResponseTime: { $avg: '$timeSpent' },
          totalRequests: { $sum: 1 },
          averageCorrectRate: { 
            $avg: { 
              $multiply: [
                { 
                  $cond: [ 
                    { $eq: ['$totalProblems', 0] }, 
                    0, 
                    { $divide: ['$correctAnswers', '$totalProblems'] }
                  ] 
                }, 
                100
              ] 
            } 
          }
        }
      }
    ]),
    Result.find({ createdAt: { $gte: past24Hours } })
      .sort({ timeSpent: -1 })
      .limit(10)
      .select('username difficulty timeSpent totalProblems correctAnswers createdAt')
      .lean()
  ]);

  // エンドポイント別統計（模擬データ）
  const endpoints = [
    {
      endpoint: '/api/problems',
      count: Math.floor(totalRequests * 0.4),
      totalTime: Math.floor(totalRequests * 0.4 * 150),
      averageTime: 150,
      minTime: 50,
      maxTime: 500,
      errors: Math.floor(totalRequests * 0.4 * 0.02),
      errorRate: 2,
      lastRequest: new Date().toISOString()
    },
    {
      endpoint: '/api/auth/login',
      count: Math.floor(totalRequests * 0.2),
      totalTime: Math.floor(totalRequests * 0.2 * 200),
      averageTime: 200,
      minTime: 100,
      maxTime: 800,
      errors: Math.floor(totalRequests * 0.2 * 0.01),
      errorRate: 1,
      lastRequest: new Date().toISOString()
    }
  ];

  const slowestEndpoints = [...endpoints].sort((a, b) => b.averageTime - a.averageTime).slice(0, 3);
  const highErrorEndpoints = [...endpoints].sort((a, b) => b.errorRate - a.errorRate).slice(0, 3);

  const formattedSlowQueries = slowQueries.map(query => ({
    requestId: query._id.toString(),
    method: 'POST',
    path: '/api/problems',
    responseTime: query.timeSpent * 1000,
    statusCode: 200,
    timestamp: query.createdAt.toISOString(),
    metadata: {
      username: query.username,
      difficulty: query.difficulty,
      correctAnswers: query.correctAnswers,
      totalProblems: query.totalProblems
    }
  }));

  const weeklyData = weeklyRequests[0] || { averageResponseTime: 150, totalRequests: 0 };
  const requestsPerMinute = Math.round(recentRequests / (24 * 60));

  const global = {
    totalRequests,
    totalErrors: Math.floor(totalRequests * 0.015),
    averageResponseTime: weeklyData.averageResponseTime || 150,
    requestsPerMinute
  };

  let healthScore = 100;
  if (global.averageResponseTime > 300) healthScore -= 20;
  if (global.averageResponseTime > 500) healthScore -= 30;
  if (requestsPerMinute < 1) healthScore -= 10;
  if (recentRequests === 0) healthScore -= 40;

  return {
    timestamp: new Date().toISOString(),
    global,
    endpoints,
    slowestEndpoints,
    highErrorEndpoints,
    slowQueries: formattedSlowQueries,
    healthScore: Math.max(0, healthScore),
    systemMetrics: {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime
    }
  };
}

module.exports = async function handler(req, res) {
  console.log(`🔍 Monitoring API: ${req.method} ${req.url}`);
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    const { type } = req.query;
    let data;
    let statusCode = 200;

    switch (type) {
      case 'health':
        data = await getHealthCheck();
        statusCode = data.status === 'healthy' ? 200 : data.status === 'warning' ? 200 : 503;
        break;
      case 'performance':
        data = await getPerformanceStats();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type parameter. Use: health or performance'
        });
    }

    return res.status(statusCode).json({
      success: statusCode < 400,
      message: `${type} monitoring data retrieved successfully`,
      data
    });

  } catch (error) {
    console.error('❌ Monitoring error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '監視データの取得中にエラーが発生しました',
      details: error.message
    });
  }
};