import express from 'express';
import { logger } from './utils/logger.js';

const app = express();

// JSON解析ミドルウェア
app.use(express.json());

// ヘルスチェックエンドポイント
app.get('/', (req, res) => {
  res.json({ 
    message: 'Morning Challenge Test Server', 
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API テストエンドポイント
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API Test successful',
    data: { test: true }
  });
});

const PORT = process.env.TEST_PORT || 5000;
app.listen(PORT, () => {
  logger.info(`✅ Test server running on port ${PORT}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/`);
  logger.info(`🧪 API test: http://localhost:${PORT}/api/test`);
}); 