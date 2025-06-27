#!/usr/bin/env node
// 🔍 MongoDB Results Collection Schema Migration - DRY RUN MODE
// 実際の変更を行わず、変更予定の内容を分析するスクリプト

const mongoose = require('mongoose');
const path = require('path');

// 環境変数の読み込み
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB接続URI
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is required');
  process.exit(1);
}

const DB_NAME = 'morning_challenge';

// ログ関数
const log = {
  info: (msg) => console.log(`[DRY-RUN] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[DRY-RUN] ${new Date().toISOString()} - ⚠️  ${msg}`),
  success: (msg) => console.log(`[DRY-RUN] ${new Date().toISOString()} - ✅ ${msg}`)
};

// 分析結果を記録するオブジェクト
const analysisResults = {
  totalDocuments: 0,
  documentsNeedingChanges: 0,
  documentsAlreadyCorrect: 0,
  userIdConversionsNeeded: 0,
  incorrectAnswersToAdd: 0,
  timestampsToAdd: 0,
  unansweredToAdd: 0,
  sampleDocuments: [],
  errors: []
};

// ObjectIdの有効性をチェックする関数
function isValidObjectId(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(str);
}

// 各ドキュメントを分析する関数
function analyzeDocument(doc) {
  const analysis = {
    _id: doc._id,
    changesNeeded: [],
    currentState: {}
  };

  // 現在の状態を記録
  analysis.currentState = {
    userId: doc.userId,
    userIdType: typeof doc.userId,
    hasIncorrectAnswers: doc.incorrectAnswers !== undefined && doc.incorrectAnswers !== null,
    hasUnanswered: doc.unanswered !== undefined && doc.unanswered !== null,
    hasTimestamp: !!doc.timestamp,
    totalProblems: doc.totalProblems || 0,
    correctAnswers: doc.correctAnswers || 0
  };

  // 1. userIdの型チェック
  if (doc.userId && typeof doc.userId === 'string') {
    if (isValidObjectId(doc.userId)) {
      analysis.changesNeeded.push({
        field: 'userId',
        action: 'convert_to_objectid',
        currentValue: doc.userId,
        newValue: `ObjectId("${doc.userId}")`
      });
      analysisResults.userIdConversionsNeeded++;
    } else {
      analysis.changesNeeded.push({
        field: 'userId',
        action: 'invalid_objectid_warning',
        currentValue: doc.userId,
        issue: 'Invalid ObjectId format'
      });
    }
  }

  // 2. incorrectAnswersフィールドのチェック
  if (doc.incorrectAnswers === undefined || doc.incorrectAnswers === null) {
    const totalProblems = doc.totalProblems || 0;
    const correctAnswers = doc.correctAnswers || 0;
    const unanswered = doc.unanswered || 0;
    const calculatedIncorrect = Math.max(0, totalProblems - correctAnswers - unanswered);
    
    analysis.changesNeeded.push({
      field: 'incorrectAnswers',
      action: 'add_calculated_value',
      currentValue: null,
      newValue: calculatedIncorrect,
      calculation: `${totalProblems} - ${correctAnswers} - ${unanswered} = ${calculatedIncorrect}`
    });
    analysisResults.incorrectAnswersToAdd++;
  }

  // 3. unansweredフィールドのチェック
  if (doc.unanswered === undefined || doc.unanswered === null) {
    analysis.changesNeeded.push({
      field: 'unanswered',
      action: 'add_default_value',
      currentValue: null,
      newValue: 0
    });
    analysisResults.unansweredToAdd++;
  }

  // 4. timestampフィールドのチェック
  if (!doc.timestamp) {
    const timestampValue = doc.createdAt || new Date();
    analysis.changesNeeded.push({
      field: 'timestamp',
      action: 'add_from_createdat_or_current',
      currentValue: null,
      newValue: timestampValue,
      source: doc.createdAt ? 'createdAt' : 'current_time'
    });
    analysisResults.timestampsToAdd++;
  }

  return analysis;
}

// ドライラン実行関数
async function performDryRun() {
  let connection;
  
  try {
    log.info('🔍 Starting Results Collection Schema Analysis (DRY RUN)');
    log.info(`📡 Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);

    // MongoDB接続（読み取り専用）
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
    analysisResults.totalDocuments = await collection.countDocuments();
    log.info(`📊 Total documents in results collection: ${analysisResults.totalDocuments}`);

    if (analysisResults.totalDocuments === 0) {
      log.warn('No documents found in results collection. Analysis skipped.');
      return;
    }

    // 分析実行
    log.info('🔄 Starting document analysis...');
    
    const cursor = collection.find({}).batchSize(100);
    let analyzedCount = 0;

    // 各ドキュメントを分析
    for await (const doc of cursor) {
      const analysis = analyzeDocument(doc);
      
      if (analysis.changesNeeded.length > 0) {
        analysisResults.documentsNeedingChanges++;
        
        // 最初の10件をサンプルとして保存
        if (analysisResults.sampleDocuments.length < 10) {
          analysisResults.sampleDocuments.push(analysis);
        }
      } else {
        analysisResults.documentsAlreadyCorrect++;
      }

      analyzedCount++;

      // 進捗表示（100件ごと）
      if (analyzedCount % 100 === 0) {
        log.info(`📈 Progress: ${analyzedCount}/${analysisResults.totalDocuments} documents analyzed`);
      }
    }

    log.success('🎉 Analysis completed successfully!');

  } catch (error) {
    log.error(`💥 Analysis failed: ${error.message}`);
    throw error;
  } finally {
    // DB接続を確実に閉じる
    if (connection) {
      await mongoose.connection.close();
      log.info('📴 Database connection closed');
    }
  }
}

// 分析レポートを表示する関数
function printAnalysisReport() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DRY RUN ANALYSIS REPORT');
  console.log('='.repeat(80));
  console.log(`📊 Total Documents: ${analysisResults.totalDocuments}`);
  console.log(`🔄 Documents Needing Changes: ${analysisResults.documentsNeedingChanges}`);
  console.log(`✅ Documents Already Correct: ${analysisResults.documentsAlreadyCorrect}`);
  console.log(`🆔 UserID Conversions Needed: ${analysisResults.userIdConversionsNeeded}`);
  console.log(`➕ IncorrectAnswers to Add: ${analysisResults.incorrectAnswersToAdd}`);
  console.log(`⏰ Timestamps to Add: ${analysisResults.timestampsToAdd}`);
  console.log(`❓ Unanswered to Add: ${analysisResults.unansweredToAdd}`);
  
  // 影響度の計算
  const impactPercentage = analysisResults.totalDocuments > 0 
    ? (analysisResults.documentsNeedingChanges / analysisResults.totalDocuments * 100).toFixed(2)
    : 0;
  
  console.log(`\n📈 Impact: ${analysisResults.documentsNeedingChanges}/${analysisResults.totalDocuments} documents (${impactPercentage}%) will be modified`);

  // サンプルドキュメントの表示
  if (analysisResults.sampleDocuments.length > 0) {
    console.log('\n📋 SAMPLE DOCUMENTS REQUIRING CHANGES:');
    analysisResults.sampleDocuments.slice(0, 3).forEach((sample, index) => {
      console.log(`\n  ${index + 1}. Document ID: ${sample._id}`);
      console.log(`     Current State:`);
      console.log(`       - userId: ${sample.currentState.userId} (${sample.currentState.userIdType})`);
      console.log(`       - hasIncorrectAnswers: ${sample.currentState.hasIncorrectAnswers}`);
      console.log(`       - hasTimestamp: ${sample.currentState.hasTimestamp}`);
      console.log(`       - hasUnanswered: ${sample.currentState.hasUnanswered}`);
      
      console.log(`     Changes Needed:`);
      sample.changesNeeded.forEach(change => {
        if (change.calculation) {
          console.log(`       - ${change.field}: ${change.action} → ${change.newValue} (${change.calculation})`);
        } else {
          console.log(`       - ${change.field}: ${change.action} → ${change.newValue}`);
        }
      });
    });
  }

  // 推奨事項
  console.log('\n💡 RECOMMENDATIONS:');
  if (analysisResults.documentsNeedingChanges === 0) {
    console.log('   ✅ No migration needed! All documents are already in the correct format.');
  } else {
    console.log('   🔧 Migration is recommended to fix schema inconsistencies.');
    console.log('   📋 Estimated migration time: ~' + Math.ceil(analysisResults.totalDocuments / 100) + ' minutes');
    
    if (analysisResults.userIdConversionsNeeded > 0) {
      console.log(`   🆔 ${analysisResults.userIdConversionsNeeded} documents need userId conversion to ObjectId`);
    }
    
    if (analysisResults.incorrectAnswersToAdd > 0) {
      console.log(`   ➕ ${analysisResults.incorrectAnswersToAdd} documents need incorrectAnswers field calculation`);
    }
    
    if (analysisResults.timestampsToAdd > 0) {
      console.log(`   ⏰ ${analysisResults.timestampsToAdd} documents need timestamp field addition`);
    }
  }

  console.log('\n🚀 NEXT STEPS:');
  console.log('   1. 💾 Create a database backup');
  console.log('   2. 🧪 Test migration on a staging environment');
  console.log('   3. ⚡ Run the actual migration: node scripts/migrate_results_schema.js');
  
  console.log('\n' + '='.repeat(80));
}

// メイン実行関数
async function main() {
  try {
    log.info('🔍 Results Schema Migration Dry Run Tool v1.0');
    log.info('📅 Started at: ' + new Date().toISOString());
    log.info('⚠️  This is a DRY RUN - no changes will be made to the database');

    // 分析実行
    await performDryRun();
    
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    // 分析レポート表示
    printAnalysisReport();
    log.info('📅 Completed at: ' + new Date().toISOString());
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = { performDryRun, analysisResults };