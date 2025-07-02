// 🔌 Shared MongoDB connection utility for Vercel serverless functions
// Implements global connection caching to reduce cold start times
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng';
const IS_PRODUCTION = process.env.VERCEL || process.env.NODE_ENV === 'production';

// Production-aware logging
const logger = {
  info: (...args) => !IS_PRODUCTION && console.log('[DB Cache]', ...args),
  debug: (...args) => !IS_PRODUCTION && console.debug('[DB Cache]', ...args),
  warn: (...args) => console.warn('[DB Cache]', ...args),
  error: (...args) => console.error('[DB Cache]', ...args)
};

// Global connection cache for Mongoose
let cachedMongoose = global.mongoose;

if (!cachedMongoose) {
  cachedMongoose = global.mongoose = { 
    conn: null, 
    promise: null,
    connectionCount: 0,
    lastConnected: null
  };
  logger.debug('🆕 Initialized Mongoose global cache');
}

// Global connection cache for native MongoDB client
let cachedClient = global.mongoClient;

if (!cachedClient) {
  cachedClient = global.mongoClient = { 
    client: null, 
    promise: null,
    connectionCount: 0,
    lastConnected: null
  };
  logger.debug('🆕 Initialized MongoDB client global cache');
}

// 🚀 OPTIMIZED Mongoose Connection for Vercel Serverless
async function connectMongoose() {
  const startTime = Date.now();
  
  // 健康な接続の再利用
  if (cachedMongoose.conn && cachedMongoose.conn.connection.readyState === 1) {
    try {
      // 簡単なヘルスチェック
      await cachedMongoose.conn.connection.db.admin().ping();
      logger.debug(`♻️ Reusing healthy connection (${Date.now() - startTime}ms)`);
      cachedMongoose.lastConnected = new Date().toISOString();
      return cachedMongoose.conn;
    } catch (healthError) {
      logger.warn('Connection unhealthy, creating new connection');
      cachedMongoose.conn = null;
      cachedMongoose.promise = null;
    }
  }

  if (!cachedMongoose.promise) {
    logger.info('🔌 Creating optimized Mongoose connection...');
    
    // 🚨 サーバーレス最適化オプション
    const opts = {
      dbName: 'morning_challenge',
      bufferCommands: false,
      
      // 🔥 重要: プール最適化（サーバーレス向け）
      maxPoolSize: 1,
      minPoolSize: 0,
      maxConnecting: 1,
      
      // 🔥 重要: タイムアウト最適化
      serverSelectionTimeoutMS: 8000,  // 8秒
      connectTimeoutMS: 10000,         // 10秒
      socketTimeoutMS: 0,              // 無制限（keep-alive）
      
      // Atlas/Serverless最適化
      heartbeatFrequencyMS: 30000,     // 30秒
      maxIdleTimeMS: 30000,            // 30秒
      retryWrites: true,
      w: 'majority',
      readConcern: { level: 'local' },
      
      // Mongoose固有
      autoIndex: false,
      autoCreate: false
    };

    cachedMongoose.promise = Promise.race([
      mongoose.connect(MONGODB_URI, opts),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out after 15s')), 15000)
      )
    ]).then((mongoose) => {
      cachedMongoose.connectionCount++;
      cachedMongoose.lastConnected = new Date().toISOString();
      
      // 重要: エラーハンドリング設定
      const conn = mongoose.connection;
      conn.removeAllListeners(); // 既存リスナー削除
      
      conn.on('error', (error) => {
        logger.error('❌ MongoDB error:', error.message);
        cachedMongoose.conn = null;
        cachedMongoose.promise = null;
      });
      
      conn.on('disconnected', () => {
        logger.warn('⚠️ MongoDB disconnected');
        cachedMongoose.conn = null;
      });
      
      logger.info(`✅ Mongoose connected successfully (${Date.now() - startTime}ms, connection #${cachedMongoose.connectionCount})`);
      return mongoose;
    }).catch((error) => {
      logger.error('❌ Mongoose connection failed:', error.message);
      cachedMongoose.promise = null;
      throw error;
    });
  }

  try {
    cachedMongoose.conn = await cachedMongoose.promise;
    return cachedMongoose.conn;
  } catch (e) {
    logger.error('❌ Connection attempt failed:', e.message);
    cachedMongoose.promise = null;
    throw e;
  }
}

// Connect via native MongoDB client (for direct operations)
async function connectMongoDB() {
  if (cachedClient.client && cachedClient.client.topology && cachedClient.client.topology.isConnected()) {
    logger.debug('♻️  Reusing existing MongoDB client connection');
    return cachedClient.client;
  }

  if (!cachedClient.promise) {
    logger.info('🔌 Creating new MongoDB client connection...');
    cachedClient.promise = MongoClient.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }).then((client) => {
      cachedClient.connectionCount++;
      cachedClient.lastConnected = new Date().toISOString();
      logger.info(`✅ MongoDB client connected successfully (connection #${cachedClient.connectionCount})`);
      return client;
    });
  }

  try {
    cachedClient.client = await cachedClient.promise;
  } catch (e) {
    logger.error('❌ MongoDB client connection failed:', e.message);
    cachedClient.promise = null;
    throw e;
  }

  return cachedClient.client;
}

// Get database instance
async function getDatabase() {
  const client = await connectMongoDB();
  return client.db('morning_challenge');
}

// Common error handler
function handleDatabaseError(error, operation = 'database operation') {
  console.error(`❌ Database error during ${operation}:`, error);
  
  if (error.name === 'MongoNetworkError') {
    return {
      success: false,
      error: 'Network connection failed',
      message: 'データベースに接続できませんでした。しばらく後にもう一度お試しください。'
    };
  }
  
  if (error.name === 'MongoTimeoutError') {
    return {
      success: false,
      error: 'Connection timeout',
      message: 'データベースの応答がタイムアウトしました。しばらく後にもう一度お試しください。'
    };
  }
  
  return {
    success: false,
    error: 'Database error',
    message: `${operation}中にエラーが発生しました。`
  };
}

// Get connection statistics for monitoring
function getConnectionStats() {
  return {
    mongoose: {
      isConnected: cachedMongoose.conn && cachedMongoose.conn.connection.readyState === 1,
      connectionCount: cachedMongoose.connectionCount,
      lastConnected: cachedMongoose.lastConnected
    },
    mongoClient: {
      isConnected: cachedClient.client && cachedClient.client.topology && cachedClient.client.topology.isConnected(),
      connectionCount: cachedClient.connectionCount,
      lastConnected: cachedClient.lastConnected
    }
  };
}

// Close all connections (for testing)
async function closeAllConnections() {
  const promises = [];
  
  if (cachedMongoose.conn) {
    logger.info('🔌 Closing Mongoose connection...');
    promises.push(cachedMongoose.conn.connection.close());
    cachedMongoose.conn = null;
    cachedMongoose.promise = null;
  }
  
  if (cachedClient.client) {
    logger.info('🔌 Closing MongoDB client connection...');
    promises.push(cachedClient.client.close());
    cachedClient.client = null;
    cachedClient.promise = null;
  }
  
  await Promise.all(promises);
  logger.info('✅ All database connections closed');
}

// 🔥 クエリ最適化ヘルパー
function optimizeQuery(query, options = {}) {
  const {
    maxTimeMS = 25000,
    lean = true,
    maxDocs = 10000
  } = options;
  
  return query
    .maxTimeMS(maxTimeMS)
    .lean(lean)
    .limit(maxDocs);
}

// 🔥 集計最適化ヘルパー
function optimizeAggregation(Model, pipeline, options = {}) {
  const {
    maxTimeMS = 25000,
    allowDiskUse = true
  } = options;
  
  return Model.aggregate(pipeline, {
    maxTimeMS,
    allowDiskUse
  });
}

// 🔥 タイムアウト付きPromiseヘルパー
function withTimeout(operation, timeoutMs, operationName = 'operation') {
  return Promise.race([
    operation,
    new Promise((_, reject) => 
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs)
    )
  ]);
}

module.exports = {
  connectMongoose,
  connectMongoDB,
  getDatabase,
  handleDatabaseError,
  getConnectionStats,
  closeAllConnections,
  MONGODB_URI,
  // 🚀 新しい最適化ツール
  optimizeQuery,
  optimizeAggregation,
  withTimeout
};