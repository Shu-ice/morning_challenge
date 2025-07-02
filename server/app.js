// Enhanced Express app with comprehensive security and error handling
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/database.js';
import dotenv from 'dotenv';
import { 
  globalErrorHandler, 
  notFoundHandler, 
  setupProcessErrorHandlers 
} from './utils/errorHandler.js';
import { getEnvironmentLimiter } from './middleware/rateLimitMiddleware.js';
import { logger } from './utils/logger.js';

// Load environment variables from .env file (root directory)
dotenv.config();

// Setup process error handlers
setupProcessErrorHandlers();

// Routes
import authRoutes from './routes/authRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import rankingRoutes from './routes/rankingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import userRoutes from './routes/userRoutes.js';
import testRoutes from './routes/testRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

const app = express();

// Security and performance middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://morning-challenge.vercel.app']
    : '*',
  credentials: true 
}));

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Global rate limiting
app.use(getEnvironmentLimiter());

// MongoDB connection middleware (Vercel optimized)
app.use(async (req, res, next) => {
  try {
    if (!global.mongoConnected) {
      logger.info('[Database] MongoDB接続を初期化中...');
      
      // Vercel環境でのタイムアウト対策
      const connectionPromise = connectDB();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 15000);
      });
      
      await Promise.race([connectionPromise, timeoutPromise]);
      global.mongoConnected = true;
      logger.info('[Database] ✅ MongoDB接続完了');
    }
    next();
  } catch (error) {
    logger.error('[Database] ❌ MongoDB接続失敗:', error.message);
    
    // 特定のAPIパスでは詳細なエラーレスポンスを返す
    if (req.path.includes('/api/test/') || req.path.includes('/api/health')) {
      res.status(500).json({ 
        success: false,
        error: 'Database connection failed',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'データベース接続エラーが発生しました' 
      });
    }
  }
});

// Route mounting
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/test', testRoutes);

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

export default app;