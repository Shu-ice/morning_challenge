import DailyProblemSet from '../models/DailyProblemSet.js';
import { getTodayJST, getYesterdayJST, getTomorrowJST } from './dateUtils.js';
import { logger } from './logger.js';
import { DifficultyRank } from '../constants/difficultyRank.js';

/**
 * システムヘルスチェック機能
 * 問題セットの存在確認、データベース接続状態、各種システム状態をチェック
 */

/**
 * 日次問題セットの健全性チェック
 * @param {string} targetDate - チェック対象日（YYYY-MM-DD）
 * @returns {Object} ヘルスチェック結果
 */
export const checkDailyProblemsHealth = async (targetDate = null) => {
  const checkDate = targetDate || getTodayJST();
  const difficulties = Object.values(DifficultyRank);
  
  const results = {
    date: checkDate,
    isHealthy: true,
    issues: [],
    details: {},
    summary: {
      total: difficulties.length,
      healthy: 0,
      missing: 0,
      empty: 0
    }
  };

  logger.info(`[HealthCheck] 問題セットヘルスチェック開始: ${checkDate}`);

  try {
    for (const difficulty of difficulties) {
      const problemSet = await DailyProblemSet.findOne({ 
        date: checkDate, 
        difficulty 
      });

      const difficultyResult = {
        difficulty,
        exists: !!problemSet,
        problemCount: problemSet?.problems?.length || 0,
        isHealthy: false,
        issues: []
      };

      if (!problemSet) {
        difficultyResult.issues.push('問題セットが存在しません');
        results.issues.push(`${difficulty}: 問題セットが存在しません`);
        results.summary.missing++;
        results.isHealthy = false;
      } else if (!problemSet.problems || problemSet.problems.length === 0) {
        difficultyResult.issues.push('問題配列が空です');
        results.issues.push(`${difficulty}: 問題配列が空です`);
        results.summary.empty++;
        results.isHealthy = false;
      } else if (problemSet.problems.length < 10) {
        difficultyResult.issues.push(`問題数が不足しています (${problemSet.problems.length}/10)`);
        results.issues.push(`${difficulty}: 問題数不足 (${problemSet.problems.length}/10)`);
        results.isHealthy = false;
      } else {
        difficultyResult.isHealthy = true;
        results.summary.healthy++;
      }

      results.details[difficulty] = difficultyResult;
    }

    logger.info(`[HealthCheck] 結果: 健全=${results.summary.healthy}/${results.summary.total}, 問題=${results.issues.length}件`);
    
    return results;
  } catch (error) {
    logger.error(`[HealthCheck] チェック中にエラー:`, error);
    return {
      date: checkDate,
      isHealthy: false,
      issues: [`チェック実行エラー: ${error.message}`],
      details: {},
      summary: { total: difficulties.length, healthy: 0, missing: 0, empty: 0 },
      error: error.message
    };
  }
};

/**
 * 複数日のヘルスチェック
 * @param {number} days - 過去何日分をチェックするか
 * @returns {Object} 複数日のヘルスチェック結果
 */
export const checkMultipleDaysHealth = async (days = 3) => {
  const today = getTodayJST();
  const results = {
    overallHealthy: true,
    checkedDays: days,
    dailyResults: {},
    summary: {
      totalDays: days,
      healthyDays: 0,
      problematicDays: 0
    }
  };

  logger.info(`[HealthCheck] ${days}日分のヘルスチェック開始`);

  for (let i = 0; i < days; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    const dayResult = await checkDailyProblemsHealth(dateStr);
    results.dailyResults[dateStr] = dayResult;

    if (dayResult.isHealthy) {
      results.summary.healthyDays++;
    } else {
      results.summary.problematicDays++;
      results.overallHealthy = false;
    }
  }

  return results;
};

/**
 * システム全体のヘルスチェック
 * @returns {Object} システムヘルスチェック結果
 */
export const checkSystemHealth = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    jstTimestamp: getTodayJST(),
    isHealthy: true,
    components: {},
    summary: {
      totalComponents: 0,
      healthyComponents: 0,
      unhealthyComponents: 0
    }
  };

  logger.info(`[HealthCheck] システム全体ヘルスチェック開始`);

  // 1. 今日の問題セットチェック
  try {
    const todayProblems = await checkDailyProblemsHealth();
    results.components.todayProblems = {
      name: '今日の問題セット',
      isHealthy: todayProblems.isHealthy,
      details: todayProblems,
      issues: todayProblems.issues
    };
  } catch (error) {
    results.components.todayProblems = {
      name: '今日の問題セット',
      isHealthy: false,
      error: error.message,
      issues: ['チェック実行エラー']
    };
  }

  // 2. データベース接続チェック
  try {
    await DailyProblemSet.countDocuments({});
    results.components.database = {
      name: 'データベース接続',
      isHealthy: true,
      details: 'MongoDB接続正常'
    };
  } catch (error) {
    results.components.database = {
      name: 'データベース接続',
      isHealthy: false,
      error: error.message,
      issues: ['データベース接続エラー']
    };
  }

  // 3. 明日の問題セット予備チェック
  try {
    const tomorrowDate = getTomorrowJST();
    const tomorrowProblems = await checkDailyProblemsHealth(tomorrowDate);
    results.components.tomorrowProblems = {
      name: '明日の問題セット',
      isHealthy: tomorrowProblems.isHealthy,
      details: tomorrowProblems,
      issues: tomorrowProblems.issues,
      isOptional: true
    };
  } catch (error) {
    results.components.tomorrowProblems = {
      name: '明日の問題セット',
      isHealthy: false,
      error: error.message,
      issues: ['チェック実行エラー'],
      isOptional: true
    };
  }

  // 結果集計
  const components = Object.values(results.components);
  results.summary.totalComponents = components.length;
  results.summary.healthyComponents = components.filter(c => c.isHealthy).length;
  results.summary.unhealthyComponents = components.filter(c => !c.isHealthy && !c.isOptional).length;

  // 必須コンポーネントがすべて健全かチェック
  results.isHealthy = components.filter(c => !c.isOptional).every(c => c.isHealthy);

  logger.info(`[HealthCheck] システムヘルス: ${results.isHealthy ? '正常' : '異常'} (${results.summary.healthyComponents}/${results.summary.totalComponents})`);

  return results;
};

/**
 * 問題セット自動生成推奨チェック
 * @returns {Object} 自動生成推奨結果
 */
export const checkAutoGenerationNeeded = async () => {
  const today = getTodayJST();
  const tomorrow = getTomorrowJST();
  
  const results = {
    today: {
      date: today,
      needsGeneration: false,
      missingDifficulties: []
    },
    tomorrow: {
      date: tomorrow,
      needsGeneration: false,
      missingDifficulties: []
    },
    overallRecommendation: 'none' // 'none', 'today', 'tomorrow', 'both'
  };

  const difficulties = Object.values(DifficultyRank);

  // 今日の問題セットチェック
  for (const difficulty of difficulties) {
    const todaySet = await DailyProblemSet.findOne({ date: today, difficulty });
    if (!todaySet || !todaySet.problems || todaySet.problems.length === 0) {
      results.today.needsGeneration = true;
      results.today.missingDifficulties.push(difficulty);
    }
  }

  // 明日の問題セットチェック
  for (const difficulty of difficulties) {
    const tomorrowSet = await DailyProblemSet.findOne({ date: tomorrow, difficulty });
    if (!tomorrowSet || !tomorrowSet.problems || tomorrowSet.problems.length === 0) {
      results.tomorrow.needsGeneration = true;
      results.tomorrow.missingDifficulties.push(difficulty);
    }
  }

  // 推奨アクション決定
  if (results.today.needsGeneration && results.tomorrow.needsGeneration) {
    results.overallRecommendation = 'both';
  } else if (results.today.needsGeneration) {
    results.overallRecommendation = 'today';
  } else if (results.tomorrow.needsGeneration) {
    results.overallRecommendation = 'tomorrow';
  }

  logger.info(`[HealthCheck] 自動生成推奨: ${results.overallRecommendation}`);
  return results;
};

/**
 * ヘルスチェック結果のサマリー生成
 * @param {Object} healthResult - ヘルスチェック結果
 * @returns {string} 人間読みやすいサマリー
 */
export const generateHealthSummary = (healthResult) => {
  if (healthResult.isHealthy) {
    return '✅ システムは正常に動作しています';
  }

  const issues = healthResult.issues || [];
  const issueCount = issues.length;
  
  if (issueCount === 0) {
    return '⚠️ システムに軽微な問題がありますが、運用に支障はありません';
  }

  return `🚨 システムに${issueCount}件の問題があります:\n${issues.slice(0, 3).map(issue => `- ${issue}`).join('\n')}${issueCount > 3 ? `\n...他${issueCount - 3}件` : ''}`;
};

export default {
  checkDailyProblemsHealth,
  checkMultipleDaysHealth,
  checkSystemHealth,
  checkAutoGenerationNeeded,
  generateHealthSummary
};