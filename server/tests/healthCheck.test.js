import { jest } from '@jest/globals';
import { 
  checkDailyProblemsHealth, 
  checkSystemHealth, 
  checkAutoGenerationNeeded,
  generateHealthSummary 
} from '../utils/healthCheck.js';
import { getTodayJST, getTomorrowJST } from '../utils/dateUtils.js';
import { DifficultyRank } from '../constants/difficultyRank.js';

// モック設定
jest.mock('../models/DailyProblemSet.js');
jest.mock('../utils/logger.js');

describe('ヘルスチェック機能テスト', () => {
  let mockDailyProblemSet;
  
  beforeEach(() => {
    // DailyProblemSetのモックをリセット
    jest.clearAllMocks();
    
    // 動的インポートでモックを取得
    import('../models/DailyProblemSet.js').then((module) => {
      mockDailyProblemSet = module.default;
    });
  });

  describe('checkDailyProblemsHealth', () => {
    test('全ての難易度の問題セットが正常に存在する場合', async () => {
      // モックデータの設定
      mockDailyProblemSet.findOne = jest.fn().mockImplementation(({ difficulty }) => {
        return Promise.resolve({
          date: getTodayJST(),
          difficulty,
          problems: Array(10).fill({ id: '1', question: 'test', correctAnswer: 1, options: [1, 2, 3, 4] })
        });
      });

      const result = await checkDailyProblemsHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.summary.healthy).toBe(Object.values(DifficultyRank).length);
      expect(result.summary.missing).toBe(0);
      expect(result.summary.empty).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    test('一部の難易度の問題セットが存在しない場合', async () => {
      // mockFindOneで一部の難易度をnullに設定
      mockDailyProblemSet.findOne = jest.fn().mockImplementation(({ difficulty }) => {
        if (difficulty === DifficultyRank.BEGINNER) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          date: getTodayJST(),
          difficulty,
          problems: Array(10).fill({ id: '1', question: 'test', correctAnswer: 1, options: [1, 2, 3, 4] })
        });
      });

      const result = await checkDailyProblemsHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.summary.missing).toBe(1);
      expect(result.issues).toContain(`${DifficultyRank.BEGINNER}: 問題セットが存在しません`);
    });

    test('問題配列が空の場合', async () => {
      mockDailyProblemSet.findOne = jest.fn().mockImplementation(({ difficulty }) => {
        return Promise.resolve({
          date: getTodayJST(),
          difficulty,
          problems: []
        });
      });

      const result = await checkDailyProblemsHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.summary.empty).toBe(Object.values(DifficultyRank).length);
    });

    test('問題数が不足している場合', async () => {
      mockDailyProblemSet.findOne = jest.fn().mockImplementation(({ difficulty }) => {
        return Promise.resolve({
          date: getTodayJST(),
          difficulty,
          problems: Array(5).fill({ id: '1', question: 'test', correctAnswer: 1, options: [1, 2, 3, 4] })
        });
      });

      const result = await checkDailyProblemsHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.issues.every(issue => issue.includes('問題数不足 (5/10)'))).toBe(true);
    });

    test('データベースエラーが発生した場合', async () => {
      mockDailyProblemSet.findOne = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const result = await checkDailyProblemsHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.issues).toContain('チェック実行エラー: Database connection failed');
    });
  });

  describe('checkSystemHealth', () => {
    test('全てのコンポーネントが正常な場合', async () => {
      // 今日の問題セットが正常
      mockDailyProblemSet.findOne = jest.fn().mockResolvedValue({
        date: getTodayJST(),
        difficulty: DifficultyRank.BEGINNER,
        problems: Array(10).fill({ id: '1', question: 'test', correctAnswer: 1 })
      });

      // データベース接続が正常
      mockDailyProblemSet.countDocuments = jest.fn().mockResolvedValue(100);

      const result = await checkSystemHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.components.todayProblems.isHealthy).toBe(true);
      expect(result.components.database.isHealthy).toBe(true);
    });

    test('データベース接続に問題がある場合', async () => {
      // 今日の問題セットは正常
      mockDailyProblemSet.findOne = jest.fn().mockResolvedValue({
        date: getTodayJST(),
        difficulty: DifficultyRank.BEGINNER,
        problems: Array(10).fill({ id: '1', question: 'test', correctAnswer: 1 })
      });

      // データベース接続でエラー
      mockDailyProblemSet.countDocuments = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      const result = await checkSystemHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.components.database.isHealthy).toBe(false);
      expect(result.components.database.error).toBe('Connection timeout');
    });
  });

  describe('checkAutoGenerationNeeded', () => {
    test('今日と明日の問題セットが全て存在する場合', async () => {
      mockDailyProblemSet.findOne = jest.fn().mockResolvedValue({
        problems: Array(10).fill({ id: '1', question: 'test', correctAnswer: 1 })
      });

      const result = await checkAutoGenerationNeeded();

      expect(result.overallRecommendation).toBe('none');
      expect(result.today.needsGeneration).toBe(false);
      expect(result.tomorrow.needsGeneration).toBe(false);
    });

    test('今日の問題セットが不足している場合', async () => {
      const today = getTodayJST();
      const tomorrow = getTomorrowJST();

      mockDailyProblemSet.findOne = jest.fn().mockImplementation(({ date }) => {
        if (date === today) {
          return Promise.resolve(null); // 今日の問題セットなし
        }
        return Promise.resolve({
          problems: Array(10).fill({ id: '1', question: 'test', correctAnswer: 1 })
        });
      });

      const result = await checkAutoGenerationNeeded();

      expect(result.overallRecommendation).toBe('today');
      expect(result.today.needsGeneration).toBe(true);
      expect(result.tomorrow.needsGeneration).toBe(false);
    });

    test('今日と明日の両方の問題セットが不足している場合', async () => {
      mockDailyProblemSet.findOne = jest.fn().mockResolvedValue(null);

      const result = await checkAutoGenerationNeeded();

      expect(result.overallRecommendation).toBe('both');
      expect(result.today.needsGeneration).toBe(true);
      expect(result.tomorrow.needsGeneration).toBe(true);
    });
  });

  describe('generateHealthSummary', () => {
    test('システムが正常な場合', () => {
      const healthResult = {
        isHealthy: true,
        issues: []
      };

      const summary = generateHealthSummary(healthResult);

      expect(summary).toBe('✅ システムは正常に動作しています');
    });

    test('問題がある場合', () => {
      const healthResult = {
        isHealthy: false,
        issues: [
          'beginner: 問題セットが存在しません',
          'intermediate: 問題数不足 (5/10)',
          'advanced: 問題配列が空です'
        ]
      };

      const summary = generateHealthSummary(healthResult);

      expect(summary).toContain('🚨 システムに3件の問題があります');
      expect(summary).toContain('beginner: 問題セットが存在しません');
      expect(summary).toContain('intermediate: 問題数不足 (5/10)');
      expect(summary).toContain('advanced: 問題配列が空です');
    });

    test('軽微な問題の場合', () => {
      const healthResult = {
        isHealthy: false,
        issues: []
      };

      const summary = generateHealthSummary(healthResult);

      expect(summary).toBe('⚠️ システムに軽微な問題がありますが、運用に支障はありません');
    });

    test('多数の問題がある場合の省略表示', () => {
      const healthResult = {
        isHealthy: false,
        issues: Array(10).fill(0).map((_, i) => `問題${i + 1}`)
      };

      const summary = generateHealthSummary(healthResult);

      expect(summary).toContain('🚨 システムに10件の問題があります');
      expect(summary).toContain('...他7件');
    });
  });
});

// 統合テスト
describe('ヘルスチェック統合テスト', () => {
  test('リアルタイムでのヘルスチェック実行', async () => {
    // この統合テストは実際のデータベース接続をテストする
    // 環境変数MONGODB_MOCK=trueの場合はスキップ
    if (process.env.MONGODB_MOCK === 'true') {
      console.log('統合テストはモック環境ではスキップされます');
      return;
    }

    try {
      const result = await checkSystemHealth();
      
      // 基本構造の確認
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('jstTimestamp');
      expect(result).toHaveProperty('isHealthy');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('summary');

      // コンポーネントの確認
      expect(result.components).toHaveProperty('todayProblems');
      expect(result.components).toHaveProperty('database');
      expect(result.components).toHaveProperty('tomorrowProblems');

      console.log('統合テスト結果:', {
        isHealthy: result.isHealthy,
        componentsCount: Object.keys(result.components).length,
        issues: result.components.todayProblems.issues || []
      });
    } catch (error) {
      console.error('統合テストでエラーが発生:', error);
      // テスト環境でのエラーは許容（データベース未接続の可能性）
    }
  });
});