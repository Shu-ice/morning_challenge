#!/usr/bin/env node

/**
 * 既存Result.gradeをUser.gradeで一括更新するバックフィルスクリプト
 * 
 * 使用法:
 *   node server/scripts/backfillGrades.js
 *   MONGODB_MOCK=true node server/scripts/backfillGrades.js  # モック環境
 */

import mongoose from 'mongoose';
import { connectDB, getMockUsers, getMockResults, updateGradeForUserResults } from '../config/database.js';
import { logger } from '../utils/logger.js';
import User from '../models/User.js';
import Result from '../models/Result.js';

/**
 * モック環境でのバックフィル
 */
async function backfillGradesInMockMode() {
  logger.info('[BackfillGrades] モック環境でのバックフィル開始');
  
  const mockUsers = getMockUsers();
  const mockResults = getMockResults();
  
  let totalUpdated = 0;
  
  // 各ユーザーについて、そのユーザーの結果レコードの学年を更新
  for (const user of mockUsers) {
    const userId = user._id;
    const currentGrade = user.grade;
    
    logger.debug(`[BackfillGrades] ユーザー ${user.username} (ID: ${userId}) の学年を ${currentGrade} に統一`);
    
    // このユーザーの結果レコード数を確認
    const userResultsCount = mockResults.filter(r => String(r.userId) === String(userId)).length;
    logger.debug(`[BackfillGrades] ユーザー ${user.username} の結果レコード数: ${userResultsCount}件`);
    
    if (userResultsCount > 0) {
      // updateGradeForUserResults 関数を使用
      const updatedCount = updateGradeForUserResults(userId, currentGrade);
      totalUpdated += updatedCount;
      
      logger.info(`[BackfillGrades] ユーザー ${user.username}: ${updatedCount}件のレコードを更新`);
    }
  }
  
  logger.info(`[BackfillGrades] モック環境バックフィル完了: 合計 ${totalUpdated}件のレコードを更新`);
  return totalUpdated;
}

/**
 * MongoDB環境でのバックフィル
 */
async function backfillGradesInMongoMode() {
  logger.info('[BackfillGrades] MongoDB環境でのバックフィル開始');
  
  try {
    // すべてのユーザーを取得
    const users = await User.find({}, '_id username grade').lean();
    logger.info(`[BackfillGrades] 対象ユーザー数: ${users.length}件`);
    
    let totalUpdated = 0;
    
    for (const user of users) {
      const userId = user._id;
      const currentGrade = user.grade;
      
      // このユーザーの結果レコードを更新
      const updateResult = await Result.updateMany(
        { userId: userId },
        { 
          $set: { 
            grade: currentGrade,
            updatedAt: new Date()
          }
        }
      );
      
      const modifiedCount = updateResult.modifiedCount;
      totalUpdated += modifiedCount;
      
      if (modifiedCount > 0) {
        logger.info(`[BackfillGrades] ユーザー ${user.username} (ID: ${userId}): ${modifiedCount}件のレコードを学年${currentGrade}に更新`);
      } else {
        logger.debug(`[BackfillGrades] ユーザー ${user.username}: 更新対象レコードなし`);
      }
    }
    
    logger.info(`[BackfillGrades] MongoDB環境バックフィル完了: 合計 ${totalUpdated}件のレコードを更新`);
    return totalUpdated;
    
  } catch (error) {
    logger.error('[BackfillGrades] MongoDB環境でのバックフィルエラー:', error);
    throw error;
  }
}

/**
 * バックフィル処理の実行統計を表示
 */
async function showBackfillStats() {
  const isMemoryMode = process.env.MONGODB_MOCK === 'true';
  
  if (isMemoryMode) {
    const mockUsers = getMockUsers();
    const mockResults = getMockResults();
    
    logger.info('[BackfillGrades] === モック環境統計 ===');
    logger.info(`総ユーザー数: ${mockUsers.length}`);
    logger.info(`総結果レコード数: ${mockResults.length}`);
    
    // 学年別の分布を表示
    const gradeDistribution = {};
    mockResults.forEach(r => {
      const grade = r.grade || 0;
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });
    
    logger.info('学年別結果レコード分布:');
    Object.entries(gradeDistribution)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([grade, count]) => {
        logger.info(`  学年${grade}: ${count}件`);
      });
      
  } else {
    try {
      const userCount = await User.countDocuments();
      const resultCount = await Result.countDocuments();
      
      logger.info('[BackfillGrades] === MongoDB環境統計 ===');
      logger.info(`総ユーザー数: ${userCount}`);
      logger.info(`総結果レコード数: ${resultCount}`);
      
      // 学年別の分布を取得
      const gradeDistribution = await Result.aggregate([
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      logger.info('学年別結果レコード分布:');
      gradeDistribution.forEach(({ _id: grade, count }) => {
        logger.info(`  学年${grade || '未設定'}: ${count}件`);
      });
      
    } catch (error) {
      logger.error('[BackfillGrades] 統計取得エラー:', error);
    }
  }
}

/**
 * メイン処理
 */
async function main() {
  const isMemoryMode = process.env.MONGODB_MOCK === 'true';
  
  logger.info('🔄 既存Result.gradeをUser.gradeで一括更新するバックフィルスクリプト');
  logger.info(`実行モード: ${isMemoryMode ? 'モック環境' : 'MongoDB環境'}`);
  
  try {
    // データベース接続
    if (!isMemoryMode) {
      await connectDB();
      logger.info('MongoDB接続完了');
    } else {
      // モック環境の場合は、initializeMockDataが自動実行される
      await connectDB();
      logger.info('モック環境初期化完了');
    }
    
    // バックフィル実行前の統計
    logger.info('\n=== バックフィル実行前の統計 ===');
    await showBackfillStats();
    
    // バックフィル実行
    logger.info('\n=== バックフィル実行 ===');
    let updatedCount;
    if (isMemoryMode) {
      updatedCount = await backfillGradesInMockMode();
    } else {
      updatedCount = await backfillGradesInMongoMode();
    }
    
    // バックフィル実行後の統計
    logger.info('\n=== バックフィル実行後の統計 ===');
    await showBackfillStats();
    
    // 結果サマリー
    logger.info('\n=== 実行結果サマリー ===');
    logger.info(`✅ バックフィル正常完了`);
    logger.info(`📊 更新されたレコード数: ${updatedCount}件`);
    
    if (updatedCount === 0) {
      logger.info('💡 更新対象のレコードがありませんでした（全て最新状態）');
    } else {
      logger.info('🎉 学年の不整合が解消されました');
    }
    
  } catch (error) {
    logger.error('❌ バックフィル実行エラー:', error);
    process.exit(1);
  } finally {
    if (!isMemoryMode && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB接続を閉じました');
    }
  }
}

// スクリプトが直接実行された場合のみmain関数を呼び出し
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('スクリプト実行エラー:', error);
    process.exit(1);
  });
}

export { backfillGradesInMockMode, backfillGradesInMongoMode, showBackfillStats }; 