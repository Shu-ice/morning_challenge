import express from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const router = express.Router();

// MongoDB Atlas接続テスト
router.get('/mongodb-test', async (req, res) => {
  try {
    logger.info('[Test] MongoDB接続状態テスト開始');
    
    // 接続状態確認
    const mongoState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    logger.info(`[Test] MongoDB状態: ${states[mongoState]} (${mongoState})`);
    
    // 簡単なクエリテスト
    if (mongoState === 1) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      logger.info(`[Test] コレクション数: ${collections.length}`);
      
      res.json({
        success: true,
        mongoState: states[mongoState],
        collections: collections.map(c => c.name),
        message: 'MongoDB Atlas接続成功'
      });
    } else {
      res.status(500).json({
        success: false,
        mongoState: states[mongoState],
        message: 'MongoDB Atlas未接続'
      });
    }
    
  } catch (error) {
    logger.error('[Test] MongoDB接続テストエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'MongoDB Atlas接続テスト失敗'
    });
  }
});

// 環境変数確認テスト
router.get('/env-test', async (req, res) => {
  try {
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      MONGODB_MOCK: process.env.MONGODB_MOCK,
      MONGODB_URI: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set',
      JWT_SECRET: process.env.JWT_SECRET ? 'Set (hidden)' : 'Not set'
    };
    
    logger.info('[Test] 環境変数確認:', envInfo);
    
    res.json({
      success: true,
      environment: envInfo,
      message: '環境変数確認完了'
    });
    
  } catch (error) {
    logger.error('[Test] 環境変数テストエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '環境変数テスト失敗'
    });
  }
});

export default router; 