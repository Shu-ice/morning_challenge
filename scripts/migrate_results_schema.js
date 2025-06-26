#!/usr/bin/env node
// 🔧 MongoDB Results Collection Schema Migration Script
// 一度だけ実行する使い捨てスクリプト - スキーマの不整合を解消

require('dotenv').config();

const mongoose = require('mongoose');
const path = require('path');
const { ObjectId } = mongoose.Types;

// 環境変数の読み込み
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB接続URI
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is required');
  process.exit(1);
}

// データベース名
const DB_NAME = 'morning_challenge';

// ログ関数
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ✅ ${msg}`)
};

// 統計情報を記録するオブジェクト
const migrationStats = {
  totalDocuments: 0,
  processedDocuments: 0,
  unchangedDocuments: 0,
  userIdConverted: 0,
  incorrectAnswersAdded: 0,
  timestampAdded: 0,
  errors: []
};

// ObjectIdの有効性をチェックする関数
function isValidObjectId(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(str);
}

// 各ドキュメントを処理する関数
async function processDocument(collection, doc) {
  let hasChanges = false;
  const updates = {};

  try {
    // 1. userIdフィールドの型変換（String → ObjectId）
    if (doc.userId && typeof doc.userId === 'string') {
      // ObjectIdとして有効な文字列の場合のみ変換
      if (isValidObjectId(doc.userId)) {
        updates.userId = new mongoose.Types.ObjectId(doc.userId);
        hasChanges = true;
        migrationStats.userIdConverted++;
        log.info(`Document ${doc._id}: Converting userId from string to ObjectId`);
      } else {
        log.warn(`Document ${doc._id}: Invalid ObjectId string format: ${doc.userId}`);
      }
    }

    // 2. incorrectAnswersフィールドの追加
    if (doc.incorrectAnswers === undefined || doc.incorrectAnswers === null) {
      const totalProblems = doc.totalProblems || 0;
      const correctAnswers = doc.correctAnswers || 0;
      const unanswered = doc.unanswered || 0;
      
      // incorrectAnswers = totalProblems - correctAnswers - unanswered
      const calculatedIncorrect = Math.max(0, totalProblems - correctAnswers - unanswered);
      
      updates.incorrectAnswers = calculatedIncorrect;
      hasChanges = true;
      migrationStats.incorrectAnswersAdded++;
      log.info(`Document ${doc._id}: Adding incorrectAnswers field (value: ${calculatedIncorrect})`);
    }

    // 3. unansweredフィールドの確認・補完
    if (doc.unanswered === undefined || doc.unanswered === null) {
      // unansweredが存在しない場合は一旦0で設定
      updates.unanswered = 0;
      hasChanges = true;
      log.info(`Document ${doc._id}: Adding unanswered field (value: 0)`);
    }

    // 4. timestampフィールドの追加
    if (!doc.timestamp && doc.createdAt) {
      updates.timestamp = doc.createdAt;
      hasChanges = true;
      migrationStats.timestampAdded++;
      log.info(`Document ${doc._id}: Adding timestamp field from createdAt`);
    } else if (!doc.timestamp && !doc.createdAt) {
      // createdAtもない場合は現在時刻を設定
      updates.timestamp = new Date();
      hasChanges = true;
      migrationStats.timestampAdded++;
      log.info(`Document ${doc._id}: Adding timestamp field with current time`);
    }

    // 変更がある場合のみ更新を実行
    if (hasChanges) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: updates }
      );
      migrationStats.processedDocuments++;
      log.success(`Document ${doc._id}: Successfully updated`);
    } else {
      migrationStats.unchangedDocuments++;
      log.info(`Document ${doc._id}: No changes required`);
    }

  } catch (error) {
    const errorMsg = `Failed to process document ${doc._id}: ${error.message}`;
    log.error(errorMsg);
    migrationStats.errors.push({
      documentId: doc._id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// メイン移行関数
async function migrateResultsSchema() {
  let connection;
  
  try {
    log.info('🚀 Starting Results Collection Schema Migration');
    log.info(`📡 Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);

    // MongoDB接続
    connection = await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000
    });

    log.success('Connected to MongoDB successfully');

    // resultsコレクションにアクセス
    const db = mongoose.connection.db;
    const collection = db.collection('results');

    // 総ドキュメント数を取得
    migrationStats.totalDocuments = await collection.countDocuments();
    log.info(`📊 Total documents in results collection: ${migrationStats.totalDocuments}`);

    if (migrationStats.totalDocuments === 0) {
      log.warn('No documents found in results collection. Migration skipped.');
      return;
    }

    // カーソルを使用してメモリ効率的にドキュメントを処理
    log.info('🔄 Starting document processing with cursor...');
    
    const cursor = collection.find({}).batchSize(100); // バッチサイズ100で処理
    let processedCount = 0;

    // 各ドキュメントを順次処理
    for await (const doc of cursor) {
      await processDocument(collection, doc);
      processedCount++;

      // 進捗表示（100件ごと）
      if (processedCount % 100 === 0) {
        log.info(`📈 Progress: ${processedCount}/${migrationStats.totalDocuments} documents processed`);
      }
    }

    log.success('🎉 Migration completed successfully!');

  } catch (error) {
    log.error(`💥 Migration failed: ${error.message}`);
    throw error;
  } finally {
    // DB接続を確実に閉じる
    if (connection) {
      await mongoose.connection.close();
      log.info('📴 Database connection closed');
    }
  }
}

// 最終レポートを表示する関数
function printMigrationReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 MIGRATION REPORT');
  console.log('='.repeat(80));
  console.log(`📊 Total Documents: ${migrationStats.totalDocuments}`);
  console.log(`✅ Processed Documents: ${migrationStats.processedDocuments}`);
  console.log(`➡️  Unchanged Documents: ${migrationStats.unchangedDocuments}`);
  console.log(`🔄 UserID Conversions: ${migrationStats.userIdConverted}`);
  console.log(`➕ IncorrectAnswers Added: ${migrationStats.incorrectAnswersAdded}`);
  console.log(`⏰ Timestamp Added: ${migrationStats.timestampAdded}`);
  console.log(`❌ Errors: ${migrationStats.errors.length}`);
  
  if (migrationStats.errors.length > 0) {
    console.log('\n🔴 ERROR DETAILS:');
    migrationStats.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. Document ${error.documentId}: ${error.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // 成功率計算
  const successRate = migrationStats.totalDocuments > 0 
    ? ((migrationStats.totalDocuments - migrationStats.errors.length) / migrationStats.totalDocuments * 100).toFixed(2)
    : 100;
  
  console.log(`🎯 Migration Success Rate: ${successRate}%`);
  console.log('='.repeat(80));
}

// 確認プロンプト関数
function askForConfirmation() {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n⚠️  WARNING: This script will modify the results collection in your database.');
    console.log('📋 Changes to be made:');
    console.log('   1. Convert userId from String to ObjectId (where applicable)');
    console.log('   2. Add incorrectAnswers field (calculated from existing data)');
    console.log('   3. Add unanswered field (set to 0 if missing)');
    console.log('   4. Add timestamp field (copied from createdAt)');
    console.log('\n💡 It is STRONGLY recommended to backup your database before proceeding.');
    
    rl.question('\n❓ Do you want to proceed? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// メイン実行関数
async function main() {
  try {
    log.info('🔧 Results Schema Migration Tool v1.0');
    log.info('📅 Started at: ' + new Date().toISOString());

    // 本番環境では確認プロンプトを表示
    if (process.env.NODE_ENV === 'production' || process.env.SKIP_CONFIRMATION !== 'true') {
      const confirmed = await askForConfirmation();
      if (!confirmed) {
        log.info('❌ Migration cancelled by user.');
        process.exit(0);
      }
    }

    // 移行実行
    await migrateResultsSchema();
    
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    // 最終レポート表示
    printMigrationReport();
    log.info('📅 Completed at: ' + new Date().toISOString());
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
  log.warn('⚠️  Received SIGINT signal. Cleaning up...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    log.info('📴 Database connection closed');
  }
  printMigrationReport();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = { migrateResultsSchema, migrationStats };