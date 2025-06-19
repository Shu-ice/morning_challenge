const request = require('supertest');
const app = require('../server');

describe('[Ranking API] undefined safety テスト', () => {
  
  describe('GET /api/rankings/daily', () => {
    test('populate成功時：正常なデータを返す', async () => {
      const response = await request(app)
        .get('/api/rankings/daily')
        .query({ date: '2025-06-19', difficulty: 'beginner' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // データが存在する場合の形式チェック
      if (response.body.data.length > 0) {
        const firstItem = response.body.data[0];
        expect(firstItem).toHaveProperty('rank');
        expect(firstItem).toHaveProperty('userId');
        expect(firstItem).toHaveProperty('username');
        expect(firstItem).toHaveProperty('avatar');
        expect(firstItem).toHaveProperty('grade');
        expect(typeof firstItem.grade).toBe('number');
        expect(firstItem.username).not.toBe(undefined);
        expect(firstItem.avatar).not.toBe(undefined);
      }
    });

    test('モック環境：500エラーが発生しない', async () => {
      // 環境変数を一時的にモックモードに設定
      const originalMockMode = process.env.MONGODB_MOCK;
      process.env.MONGODB_MOCK = 'true';

      try {
        const response = await request(app)
          .get('/api/rankings/daily')
          .query({ date: '2025-06-19' });

        expect(response.status).not.toBe(500);
        expect(response.body).toHaveProperty('success');
        
        if (response.body.success && response.body.data) {
          response.body.data.forEach(item => {
            expect(item).toHaveProperty('userId');
            expect(item).toHaveProperty('username');
            expect(item).toHaveProperty('grade');
            expect(item).toHaveProperty('avatar');
            expect(typeof item.grade).toBe('number');
            expect(item.username).not.toBe(undefined);
            expect(item.avatar).not.toBe(undefined);
          });
        }
      } finally {
        // 環境変数を元に戻す
        process.env.MONGODB_MOCK = originalMockMode;
      }
    });

    test('無効なクエリパラメータ：エラーハンドリング', async () => {
      const response = await request(app)
        .get('/api/rankings/daily')
        .query({ date: 'invalid-date', difficulty: 'invalid-difficulty' });

      // 500エラーではなく、適切にハンドリングされることを確認
      expect(response.status).not.toBe(500);
      expect(response.body).toHaveProperty('success');
    });

    test('空のデータ：正常なレスポンス形式', async () => {
      const response = await request(app)
        .get('/api/rankings/daily')
        .query({ date: '1970-01-01' }); // 存在しない日付

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/rankings/weekly', () => {
    test('週間ランキング：基本動作確認', async () => {
      const response = await request(app)
        .get('/api/rankings/weekly');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const firstItem = response.body.data[0];
        expect(firstItem).toHaveProperty('grade');
        expect(typeof firstItem.grade).toBe('number');
        expect(firstItem.username).not.toBe(undefined);
        expect(firstItem.avatar).not.toBe(undefined);
      }
    });

    test('週間ランキング：モック環境での安全性', async () => {
      const originalMockMode = process.env.MONGODB_MOCK;
      process.env.MONGODB_MOCK = 'true';

      try {
        const response = await request(app)
          .get('/api/rankings/weekly');

        expect(response.status).not.toBe(500);
        expect(response.body).toHaveProperty('success');
      } finally {
        process.env.MONGODB_MOCK = originalMockMode;
      }
    });
  });

  describe('GET /api/rankings/monthly', () => {
    test('月間ランキング：基本動作確認', async () => {
      const response = await request(app)
        .get('/api/rankings/monthly');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const firstItem = response.body.data[0];
        expect(firstItem).toHaveProperty('grade');
        expect(typeof firstItem.grade).toBe('number');
        expect(firstItem.username).not.toBe(undefined);
        expect(firstItem.avatar).not.toBe(undefined);
      }
    });

    test('月間ランキング：モック環境での安全性', async () => {
      const originalMockMode = process.env.MONGODB_MOCK;
      process.env.MONGODB_MOCK = 'true';

      try {
        const response = await request(app)
          .get('/api/rankings/monthly');

        expect(response.status).not.toBe(500);
        expect(response.body).toHaveProperty('success');
      } finally {
        process.env.MONGODB_MOCK = originalMockMode;
      }
    });
  });

  describe('GET /api/rankings/me', () => {
    test('ユーザーランキング：認証が必要', async () => {
      const response = await request(app)
        .get('/api/rankings/me');

      expect(response.status).toBe(401);
    });
  });

  describe('[Regression] TypeError防止テスト', () => {
    test('populate失敗時のObjectId文字列処理', async () => {
      // このテストは特定の条件下でpopulateが失敗することを想定
      const response = await request(app)
        .get('/api/rankings/daily')
        .query({ date: '2025-06-19' });

      // 重要：500エラーが発生しないことを確認
      expect(response.status).not.toBe(500);
      
      if (response.body.success && response.body.data) {
        response.body.data.forEach(item => {
          // TypeErrorの原因となるundefinedフィールドが存在しないことを確認
          expect(item.userId).toBeDefined();
          expect(item.username).toBeDefined();
          expect(item.grade).toBeDefined();
          expect(item.avatar).toBeDefined();
          
          // gradeは数値型であることを確認
          expect(typeof item.grade).toBe('number');
        });
      }
    });

    test('モック環境での_id未定義ユーザー処理', async () => {
      const originalMockMode = process.env.MONGODB_MOCK;
      process.env.MONGODB_MOCK = 'true';

      try {
        const response = await request(app)
          .get('/api/rankings/daily');

        expect(response.status).not.toBe(500);
        
        if (response.body.success && response.body.data) {
          response.body.data.forEach(item => {
            expect(item.userId).toBeDefined();
            expect(item.username).toBeDefined();
            expect(item.grade).toBeDefined();
            expect(typeof item.grade).toBe('number');
          });
        }
      } finally {
        process.env.MONGODB_MOCK = originalMockMode;
      }
    });
  });
});