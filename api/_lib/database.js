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

// Connect via Mongoose (for schema-based operations)
async function connectMongoose() {
  if (cachedMongoose.conn && cachedMongoose.conn.connection.readyState === 1) {
    logger.debug('♻️  Reusing existing Mongoose connection');
    return cachedMongoose.conn;
  }

  if (!cachedMongoose.promise) {
    logger.info('🔌 Creating new Mongoose connection...');
    const opts = {
      dbName: 'morning_challenge',
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cachedMongoose.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      cachedMongoose.connectionCount++;
      cachedMongoose.lastConnected = new Date().toISOString();
      logger.info(`✅ Mongoose connected successfully (connection #${cachedMongoose.connectionCount})`);
      return mongoose;
    });
  }

  try {
    cachedMongoose.conn = await cachedMongoose.promise;
  } catch (e) {
    logger.error('❌ Mongoose connection failed:', e.message);
    cachedMongoose.promise = null;
    throw e;
  }

  return cachedMongoose.conn;
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

module.exports = {
  connectMongoose,
  connectMongoDB,
  getDatabase,
  handleDatabaseError,
  getConnectionStats,
  closeAllConnections,
  MONGODB_URI
};