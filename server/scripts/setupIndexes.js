import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

/**
 * MongoDB Composite Indexes Setup for Performance Optimization
 */

const setupIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for index setup');

    const db = mongoose.connection.db;

    // Results Collection Indexes
    const resultsCollection = db.collection('results');
    
    logger.info('Setting up Results collection indexes...');

    // 1. 既存インデックスの確認
    const existingIndexes = await resultsCollection.indexes();
    logger.info('Existing indexes:', JSON.stringify(existingIndexes, null, 2));

    // 2. パフォーマンス重要度順のインデックス設計
    
    // ランキング表示用（最も重要）
    // 難易度・日付別でスコア順ソート用
    await resultsCollection.createIndex(
      { difficulty: 1, date: 1, score: -1 },
      { name: 'difficulty_date_score_desc' }
    );
    logger.info('✓ Created: difficulty_date_score_desc');

    // ユーザー履歴表示用（次に重要）
    // 特定ユーザーの履歴を日付順で取得
    await resultsCollection.createIndex(
      { userId: 1, date: -1 },
      { name: 'userId_date_desc' }
    );
    logger.info('✓ Created: userId_date_desc');

    // 管理者・統計分析用
    // 日付期間での集計クエリ用
    await resultsCollection.createIndex(
      { date: 1, difficulty: 1, createdAt: 1 },
      { name: 'date_difficulty_createdAt' }
    );
    logger.info('✓ Created: date_difficulty_createdAt');

    // ユーザー統計用（特定ユーザーの難易度別成績）
    await resultsCollection.createIndex(
      { userId: 1, difficulty: 1, score: -1 },
      { name: 'userId_difficulty_score_desc' }
    );
    logger.info('✓ Created: userId_difficulty_score_desc');

    // 時間ベース分析用（パフォーマンス分析）
    await resultsCollection.createIndex(
      { timeSpent: 1, score: -1, difficulty: 1 },
      { name: 'timeSpent_score_difficulty' }
    );
    logger.info('✓ Created: timeSpent_score_difficulty');

    // Users Collection Indexes
    const usersCollection = db.collection('users');
    
    logger.info('Setting up Users collection indexes...');

    // メール検索用（ログイン時の高速化）
    await usersCollection.createIndex(
      { email: 1 },
      { unique: true, name: 'email_unique' }
    );
    logger.info('✓ Created: email_unique');

    // ユーザー名検索用
    await usersCollection.createIndex(
      { username: 1 },
      { name: 'username_search' }
    );
    logger.info('✓ Created: username_search');

    // 学年別検索用（統計分析）
    await usersCollection.createIndex(
      { grade: 1, createdAt: -1 },
      { name: 'grade_createdAt_desc' }
    );
    logger.info('✓ Created: grade_createdAt_desc');

    // DailyProblemSets Collection Indexes
    const problemSetsCollection = db.collection('dailyproblemsets');
    
    logger.info('Setting up DailyProblemSets collection indexes...');

    // 問題取得用（最重要）
    await problemSetsCollection.createIndex(
      { date: 1, difficulty: 1, isActive: 1 },
      { name: 'date_difficulty_active' }
    );
    logger.info('✓ Created: date_difficulty_active');

    // 問題管理用
    await problemSetsCollection.createIndex(
      { createdAt: -1, isActive: 1 },
      { name: 'createdAt_desc_active' }
    );
    logger.info('✓ Created: createdAt_desc_active');

    // Items Collection Indexes（もし使用している場合）
    const itemsCollection = db.collection('items');
    
    logger.info('Setting up Items collection indexes...');

    // アイテム検索用
    await itemsCollection.createIndex(
      { difficulty: 1, type: 1 },
      { name: 'difficulty_type' }
    );
    logger.info('✓ Created: difficulty_type');

    logger.info('All indexes created successfully!');

    // インデックス使用統計を有効化
    await db.admin().command({ setParameter: 1, logLevel: 1 });
    logger.info('MongoDB logging enabled for index usage analysis');

  } catch (error) {
    logger.error('Error setting up indexes:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
};

// インデックス統計とパフォーマンス分析
const analyzeIndexUsage = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    logger.info('Analyzing index usage...');

    // Results collection statistics
    const resultsStats = await db.collection('results').stats();
    logger.info('Results collection stats:', {
      count: resultsStats.count,
      avgObjSize: resultsStats.avgObjSize,
      indexSizes: resultsStats.indexSizes
    });

    // Index usage statistics (requires MongoDB 3.2+)
    const indexStats = await db.collection('results').aggregate([
      { $indexStats: {} }
    ]).toArray();
    
    logger.info('Index usage statistics:');
    indexStats.forEach(stat => {
      logger.info(`Index: ${stat.name}, Usage: ${stat.accesses.ops || 0} operations`);
    });

  } catch (error) {
    logger.error('Error analyzing index usage:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// 実行モード判定
const command = process.argv[2];

if (command === 'setup') {
  setupIndexes().catch(error => {
    logger.error('Setup failed:', error);
    process.exit(1);
  });
} else if (command === 'analyze') {
  analyzeIndexUsage().catch(error => {
    logger.error('Analysis failed:', error);
    process.exit(1);
  });
} else {
  logger.info('Usage: node setupIndexes.js [setup|analyze]');
  process.exit(1);
}

export { setupIndexes, analyzeIndexUsage };