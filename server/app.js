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

const app = express();

// Basic middlewares
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Route mounting
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/users', userRoutes);

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true });
});

await connectDB();
console.log('✅ MongoDB connected');

export default app;