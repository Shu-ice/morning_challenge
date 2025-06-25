// Shared MongoDB connection utility for Vercel serverless functions
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng';

// Global connection cache for Mongoose
let cachedMongoose = global.mongoose;

if (!cachedMongoose) {
  cachedMongoose = global.mongoose = { conn: null, promise: null };
}

// Global connection cache for native MongoDB client
let cachedClient = global.mongoClient;

if (!cachedClient) {
  cachedClient = global.mongoClient = { client: null, promise: null };
}

// Connect via Mongoose (for schema-based operations)
async function connectMongoose() {
  if (cachedMongoose.conn) {
    return cachedMongoose.conn;
  }

  if (!cachedMongoose.promise) {
    const opts = {
      dbName: 'morning_challenge',
      bufferCommands: false,
    };

    cachedMongoose.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cachedMongoose.conn = await cachedMongoose.promise;
  } catch (e) {
    cachedMongoose.promise = null;
    throw e;
  }

  return cachedMongoose.conn;
}

// Connect via native MongoDB client (for direct operations)
async function connectMongoDB() {
  if (cachedClient.client && cachedClient.client.topology && cachedClient.client.topology.isConnected()) {
    return cachedClient.client;
  }

  if (!cachedClient.promise) {
    cachedClient.promise = MongoClient.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }).then((client) => {
      return client;
    });
  }

  try {
    cachedClient.client = await cachedClient.promise;
  } catch (e) {
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

module.exports = {
  connectMongoose,
  connectMongoDB,
  getDatabase,
  handleDatabaseError,
  MONGODB_URI
};