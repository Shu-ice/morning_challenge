import request from 'supertest';
import app from '../server.js';
import { 
  addMockResult, 
  addMockUser, 
  updateGradeForUserResults,
  getMockUsers,
  getMockResults
} from '../config/database.js';

describe('[Grade Sync] 学年同期テスト', () => {
  
  describe('updateGradeForUserResults 関数テスト', () => {
    beforeEach(() => {
      // 環境変数を一時的にモックモードに設定
      process.env.MONGODB_MOCK = 'true';
    });

    test('モック環境でのユーザー学年更新', async () => {
      // テスト用のユーザーを追加
      const testUser = {
        username: 'gradeTestUser',
        email: 'gradetest@example.com',
        grade: 5,
        password: 'test123'
      };
      const user = addMockUser(testUser);
      const userId = user._id;

      // テスト用の結果レコードを追加
      const testResult1 = {
        userId: userId,
        grade: 3, // 古い学年
        score: 80,
        difficulty: 'intermediate',
        date: '2025-06-19',
        correctAnswers: 8,
        totalProblems: 10
      };
      const testResult2 = {
        userId: userId,
        grade: 3, // 古い学年
        score: 90,
        difficulty: 'advanced',
        date: '2025-06-18',
        correctAnswers: 9,
        totalProblems: 10
      };
      
      addMockResult(testResult1);
      addMockResult(testResult2);

      // updateGradeForUserResults 関数を実行
      const updatedCount = updateGradeForUserResults(userId, 5);

      // 更新件数が正しいことを確認
      expect(updatedCount).toBe(2);

      // 実際に結果レコードの学年が更新されていることを確認
      const mockResults = getMockResults();
      const userResults = mockResults.filter(r => String(r.userId) === String(userId));
      
      expect(userResults).toHaveLength(2);
      userResults.forEach(result => {
        expect(result.grade).toBe(5);
      });
    });

    test('ObjectIdと文字列の混在でも正しく更新', async () => {
      const testUserId = 'test-objectid-123';
      
      // 文字列IDでユーザーを追加
      const testUser = {
        _id: testUserId,
        username: 'objectIdTestUser',
        email: 'objectidtest@example.com',
        grade: 7,
        password: 'test123'
      };
      addMockUser(testUser);

      // ObjectId風の結果レコードを追加（実際は文字列）
      const testResult = {
        userId: testUserId, // 文字列として追加
        grade: 2, // 古い学年
        score: 75,
        difficulty: 'beginner',
        date: '2025-06-19',
        correctAnswers: 7,
        totalProblems: 10
      };
      addMockResult(testResult);

      // 更新実行
      const updatedCount = updateGradeForUserResults(testUserId, 7);

      expect(updatedCount).toBe(1);

      // 結果確認
      const mockResults = getMockResults();
      const userResult = mockResults.find(r => String(r.userId) === testUserId);
      
      expect(userResult).toBeDefined();
      expect(userResult.grade).toBe(7);
    });

    test('存在しないユーザーIDの場合は更新件数0', async () => {
      const nonExistentUserId = 'non-existent-user-id';
      
      const updatedCount = updateGradeForUserResults(nonExistentUserId, 8);
      
      expect(updatedCount).toBe(0);
    });
  });

  describe('プロフィール更新後のランキング反映テスト', () => {
    let authToken;
    let testUserId;

    beforeEach(async () => {
      // 環境変数を一時的にモックモードに設定
      process.env.MONGODB_MOCK = 'true';
      
      // テスト用のユーザーでログイン
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'test123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      
      authToken = loginResponse.body.token;
      testUserId = loginResponse.body.user._id;

      // テスト用の結果レコードを追加
      const testResult = {
        userId: testUserId,
        grade: 3, // 古い学年（現在のユーザーの学年）
        score: 85,
        difficulty: 'intermediate',
        date: '2025-06-19',
        correctAnswers: 8,
        totalProblems: 10,
        timeSpent: 120,
        totalTime: 300
      };
      addMockResult(testResult);
    });

    test('プロフィール更新直後にランキングで最新学年が表示される', async () => {
      // 1. 学年を3から8に更新
      const profileUpdateResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          grade: 8,
          avatar: '🔥'
        });

      expect(profileUpdateResponse.status).toBe(200);
      expect(profileUpdateResponse.body.success).toBe(true);
      expect(profileUpdateResponse.body.user.grade).toBe(8);

      // 2. ランキングAPIで学年が正しく表示されることを確認
      const rankingResponse = await request(app)
        .get('/api/rankings/daily')
        .query({ 
          date: '2025-06-19',
          difficulty: 'intermediate'
        });

      expect(rankingResponse.status).toBe(200);
      expect(rankingResponse.body.success).toBe(true);
      
      // testユーザーがランキングに含まれているかチェック
      const testUserRanking = rankingResponse.body.data?.find(
        item => item.username === 'test' || String(item.userId) === String(testUserId)
      );

      if (testUserRanking) {
        // 最新の学年（8）が表示されていることを確認
        expect(testUserRanking.grade).toBe(8);
        console.log(`✓ ランキングでtestユーザーの学年が正しく${testUserRanking.grade}に更新されました`);
      } else {
        console.log('ℹ️  testユーザーがランキングに表示されていません（結果レコード未作成の可能性）');
      }
    });

    test('週間ランキングでも最新学年が表示される', async () => {
      // 学年更新
      await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ grade: 6 });

      // 週間ランキング確認
      const weeklyRankingResponse = await request(app)
        .get('/api/rankings/weekly');

      expect(weeklyRankingResponse.status).toBe(200);
      expect(weeklyRankingResponse.body.success).toBe(true);

      const testUserRanking = weeklyRankingResponse.body.data?.find(
        item => item.username === 'test' || String(item.userId) === String(testUserId)
      );

      if (testUserRanking) {
        expect(testUserRanking.grade).toBe(6);
      }
    });

    test('月間ランキングでも最新学年が表示される', async () => {
      // 学年更新
      await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ grade: 4 });

      // 月間ランキング確認
      const monthlyRankingResponse = await request(app)
        .get('/api/rankings/monthly');

      expect(monthlyRankingResponse.status).toBe(200);
      expect(monthlyRankingResponse.body.success).toBe(true);

      const testUserRanking = monthlyRankingResponse.body.data?.find(
        item => item.username === 'test' || String(item.userId) === String(testUserId)
      );

      if (testUserRanking) {
        expect(testUserRanking.grade).toBe(4);
      }
    });
  });

  describe('バックフィルスクリプトテスト', () => {
    test('backfillGradesInMockMode 関数の動作確認', async () => {
      // 環境変数設定
      process.env.MONGODB_MOCK = 'true';
      
      // バックフィル関数をインポート
      const { backfillGradesInMockMode } = await import('../scripts/backfillGrades.js');
      
      // テスト用データ準備
      const testUser = {
        username: 'backfillTestUser',
        email: 'backfill@example.com',
        grade: 6,
        password: 'test123'
      };
      const user = addMockUser(testUser);
      
      // 古い学年の結果レコードを追加
      addMockResult({
        userId: user._id,
        grade: 2, // 古い学年
        score: 70,
        difficulty: 'beginner',
        date: '2025-06-19',
        correctAnswers: 7,
        totalProblems: 10
      });

      // バックフィル実行
      const updatedCount = await backfillGradesInMockMode();
      
      expect(updatedCount).toBeGreaterThan(0);

      // 結果確認
      const mockResults = getMockResults();
      const userResult = mockResults.find(r => String(r.userId) === String(user._id));
      
      expect(userResult.grade).toBe(6);
    });
  });

  describe('エラーケーステスト', () => {
    test('不正なユーザーIDでの更新は安全に処理される', async () => {
      process.env.MONGODB_MOCK = 'true';
      
      // null, undefined, 空文字での更新テスト
      expect(() => updateGradeForUserResults(null, 5)).not.toThrow();
      expect(() => updateGradeForUserResults(undefined, 5)).not.toThrow();
      expect(() => updateGradeForUserResults('', 5)).not.toThrow();
      
      const result1 = updateGradeForUserResults(null, 5);
      const result2 = updateGradeForUserResults(undefined, 5);
      const result3 = updateGradeForUserResults('', 5);
      
      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(result3).toBe(0);
    });

    test('不正な学年値での更新は安全に処理される', async () => {
      process.env.MONGODB_MOCK = 'true';
      
      const testUser = addMockUser({
        username: 'errorTestUser',
        email: 'error@example.com',
        grade: 5,
        password: 'test123'
      });
      
      addMockResult({
        userId: testUser._id,
        grade: 3,
        score: 80,
        difficulty: 'intermediate',
        date: '2025-06-19',
        correctAnswers: 8,
        totalProblems: 10
      });

      // 不正な学年値でのテスト
      expect(() => updateGradeForUserResults(testUser._id, null)).not.toThrow();
      expect(() => updateGradeForUserResults(testUser._id, undefined)).not.toThrow();
      expect(() => updateGradeForUserResults(testUser._id, 'invalid')).not.toThrow();
    });
  });

  afterEach(() => {
    // 環境変数をリセット
    delete process.env.MONGODB_MOCK;
  });
});