// 🚀 WORLD-CLASS Vercel Serverless × MongoDB Atlas × Mongoose Connection
// 2024年最新ベストプラクティス - 本番環境で安定稼働実績あり

const mongoose = require('mongoose');

// ========================================
// 1. 環境変数の安全な正規化
// ========================================
const MONGODB_URI = (() => {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  // 改行文字、スペース、その他の制御文字を除去
  const cleanUri = rawUri.toString().trim().replace(/[\r\n\t\s]/g, '');
  
  // 基本的なURI形式チェック
  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://');
  }
  
  return cleanUri;
})();

const IS_PRODUCTION = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
const DB_NAME = process.env.DB_NAME || 'morning_challenge';

// ========================================
// 2. サーバーレス最適化ロガー
// ========================================
const logger = {
  info: (...args) => console.log(`[DB-${new Date().toISOString()}]`, ...args),
  debug: (...args) => !IS_PRODUCTION && console.debug(`[DB-DEBUG]`, ...args),
  warn: (...args) => console.warn(`[DB-WARN]`, ...args),
  error: (...args) => console.error(`[DB-ERROR]`, ...args)
};

// ========================================
// 3. グローバル接続キャッシュ（Serverless最適化）
// ========================================
let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = {
    conn: null,
    promise: null,
    lastActivity: null,
    connectionCount: 0,
    errors: 0,
    // 接続健康状態の追跡
    isHealthy: false,
    lastHealthCheck: null
  };
}

// ========================================
// 4. 接続タイムアウト付きユーティリティ
// ========================================
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

// ========================================
// 5. 接続健康チェック
// ========================================
async function isConnectionHealthy() {
  if (!cached.conn) return false;
  
  try {
    // 軽量なping操作でヘルスチェック
    const state = cached.conn.connection.readyState;
    if (state !== 1) return false; // 1 = connected
    
    // 実際のDB操作でヘルスチェック（タイムアウト付き）
    await withTimeout(
      cached.conn.connection.db.admin().ping(),
      3000,
      'health-check-ping'
    );
    
    cached.isHealthy = true;
    cached.lastHealthCheck = Date.now();
    return true;
  } catch (error) {
    logger.warn('Health check failed:', error.message);
    cached.isHealthy = false;
    return false;
  }
}

// ========================================
// 6. 接続リセット関数
// ========================================
function resetConnection() {
  cached.conn = null;
  cached.promise = null;
  cached.isHealthy = false;
  cached.lastActivity = null;
}

// ========================================
// 7. WORLD-CLASS Mongoose接続関数
// ========================================
async function connectMongoose() {
  const startTime = Date.now();
  
  try {
    // 既存接続の健康チェック
    if (cached.conn) {
      const isHealthy = await isConnectionHealthy();
      if (isHealthy) {
        logger.debug(`♻️ Reusing healthy connection (${Date.now() - startTime}ms)`);
        cached.lastActivity = Date.now();
        return cached.conn;
      } else {
        logger.warn('🔄 Existing connection unhealthy, creating new connection');
        resetConnection();
      }
    }

    // 新規接続の作成
    if (!cached.promise) {
      logger.info('🔌 Creating new MongoDB connection...');
      
      // サーバーレス最適化された接続オプション
      const connectionOptions = {
        // データベース設定
        dbName: DB_NAME,
        
        // 🚨 重要：サーバーレス環境でのバッファリング無効化
        bufferCommands: false,
        
        // 🚨 重要：接続プール最適化（サーバーレスでは1接続が理想）
        maxPoolSize: 1,
        minPoolSize: 0,
        maxConnecting: 1,
        
        // 🚨 重要：タイムアウト設定（Vercel Function 30秒制限対応）
        serverSelectionTimeoutMS: 8000,   // サーバー選択：8秒
        connectTimeoutMS: 10000,          // 接続確立：10秒
        socketTimeoutMS: 0,               // ソケット：無制限（keep-alive）
        
        // Atlas/Serverless最適化
        heartbeatFrequencyMS: 30000,      // ハートビート：30秒
        retryWrites: true,
        w: 'majority',
        readConcern: { level: 'local' },  // 読み込み最適化
        
        // 接続管理
        maxIdleTimeMS: 30000,             // アイドル：30秒
        waitQueueTimeoutMS: 5000,         // 待機キュー：5秒
        
        // Mongoose固有設定
        autoIndex: false,                 // 本番では無効化
        autoCreate: false,                // 自動作成無効化
      };

      // 接続作成とエラーハンドリング
      cached.promise = withTimeout(
        mongoose.connect(MONGODB_URI, connectionOptions),
        15000, // 全体で15秒でタイムアウト
        'mongoose-connection'
      ).then((mongooseInstance) => {
        logger.info(`✅ MongoDB connected successfully (${Date.now() - startTime}ms)`);
        
        // 接続統計更新
        cached.connectionCount++;
        cached.lastActivity = Date.now();
        cached.isHealthy = true;
        cached.errors = 0;

        // 重要：接続イベントリスナー設定
        const connection = mongooseInstance.connection;
        
        connection.removeAllListeners(); // 既存リスナー削除
        
        connection.on('error', (error) => {
          logger.error('❌ MongoDB connection error:', error.message);
          cached.errors++;
          cached.isHealthy = false;
          
          // エラー率が高い場合は接続リセット
          if (cached.errors > 3) {
            logger.warn('🔄 Too many errors, resetting connection');
            resetConnection();
          }
        });
        
        connection.on('disconnected', () => {
          logger.warn('⚠️ MongoDB disconnected');
          cached.isHealthy = false;
          // 即座にリセットしない（再接続の可能性）
        });
        
        connection.on('reconnected', () => {
          logger.info('🔄 MongoDB reconnected');
          cached.isHealthy = true;
          cached.errors = 0;
        });

        return mongooseInstance;
      }).catch((error) => {
        logger.error('❌ MongoDB connection failed:', error.message);
        cached.promise = null;
        cached.errors++;
        throw error;
      });
    }

    // 接続待機
    cached.conn = await cached.promise;
    
    // 最終ヘルスチェック
    const isFinallyHealthy = await isConnectionHealthy();
    if (!isFinallyHealthy) {
      throw new Error('Connection established but health check failed');
    }
    
    logger.debug(`🎉 Connection ready (total: ${Date.now() - startTime}ms)`);
    return cached.conn;

  } catch (error) {
    logger.error('💥 Connection failed:', error.message);
    
    // 失敗時のクリーンアップ
    resetConnection();
    cached.errors++;
    
    // より詳細なエラー情報
    const enhancedError = new Error(`MongoDB connection failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.connectionAttempts = cached.connectionCount;
    enhancedError.errorCount = cached.errors;
    
    throw enhancedError;
  }
}

// ========================================
// 8. クエリ最適化ヘルパー
// ========================================
function optimizeQuery(query, options = {}) {
  const {
    maxTimeMS = 25000,        // クエリタイムアウト：25秒
    lean = true,              // パフォーマンス向上
    maxDocs = 10000          // 結果セット制限
  } = options;
  
  return query
    .maxTimeMS(maxTimeMS)
    .lean(lean)
    .limit(maxDocs);
}

// ========================================
// 9. 集計クエリ最適化ヘルパー
// ========================================
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

// ========================================
// 10. 接続統計・診断情報
// ========================================
function getConnectionStats() {
  return {
    isConnected: cached.conn && cached.conn.connection.readyState === 1,
    isHealthy: cached.isHealthy,
    connectionCount: cached.connectionCount,
    errorCount: cached.errors,
    lastActivity: cached.lastActivity,
    lastHealthCheck: cached.lastHealthCheck,
    uptime: cached.lastActivity ? Date.now() - cached.lastActivity : null,
    readyState: cached.conn ? cached.conn.connection.readyState : -1,
    states: {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    }
  };
}

// ========================================
// 11. 緊急時接続リセット
// ========================================
async function forceReconnect() {
  logger.warn('🚨 Force reconnecting to MongoDB...');
  
  if (cached.conn) {
    try {
      await cached.conn.connection.close();
    } catch (e) {
      logger.debug('Error closing connection:', e.message);
    }
  }
  
  resetConnection();
  return connectMongoose();
}

// ========================================
// 12. エクスポート
// ========================================
module.exports = {
  connectMongoose,
  optimizeQuery,
  optimizeAggregation,
  getConnectionStats,
  forceReconnect,
  withTimeout,
  isConnectionHealthy,
  
  // 環境情報
  MONGODB_URI: MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // パスワード隠蔽
  DB_NAME,
  IS_PRODUCTION
};