// Replacing entire file with minimal Express app for Vercel
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/database.js';
import dotenv from 'dotenv';

// Load environment variables from .env file (root directory)
dotenv.config();

// Routes
import authRoutes from './routes/authRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import rankingRoutes from './routes/rankingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import userRoutes from './routes/userRoutes.js';
import testRoutes from './routes/testRoutes.js';

const app = express();

// Basic middlewares
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection middleware (Vercel optimized)
app.use(async (req, res, next) => {
  try {
    if (!global.mongoConnected) {
      console.log('🔗 Initializing MongoDB connection...');
      
      // Vercel環境でのタイムアウト対策
      const connectionPromise = connectDB();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 15000);
      });
      
      await Promise.race([connectionPromise, timeoutPromise]);
      global.mongoConnected = true;
      console.log('✅ MongoDB connected');
    }
    next();
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // 特定のAPIパスではエラーレスポンスを返す
    if (req.path.includes('/api/test/') || req.path.includes('/api/health')) {
      res.status(500).json({ 
        error: 'Database connection failed',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: 'Database connection failed' });
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
app.use('/api/test', testRoutes);

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true });
});

export default app;