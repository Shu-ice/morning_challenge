// API Tests for Admin Users Endpoints
// /api/admin/users のテスト

const request = require('supertest');
const jwt = require('jsonwebtoken');

// モックアプリケーション（Express風）
const createMockApp = () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  // Admin index API をモック（統合エンドポイント）
  const adminIndexHandler = require('../admin/index');
  app.get('/api/admin/index', (req, res) => adminIndexHandler(req, res));
  
  // 従来のURLも新しいエンドポイントにリダイレクト
  app.get('/api/admin/users', (req, res) => {
    req.query.path = 'users';
    adminIndexHandler(req, res);
  });
  
  return app;
};

// テスト用のJWTトークン生成
const createTestToken = (isAdmin = true) => {
  return jwt.sign(
    { userId: 'test-user-id', isAdmin },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('/api/admin/users API Tests', () => {
  let app;
  
  beforeEach(() => {
    app = createMockApp();
    // モック環境を設定
    process.env.MONGODB_MOCK = 'true';
  });

  afterEach(() => {
    // 環境変数をクリーンアップ
    delete process.env.MONGODB_MOCK;
  });

  describe('GET /api/admin/users', () => {
    test('認証なしでアクセスすると401エラーが返る', async () => {
      const response = await request(app)
        .get('/api/admin/users');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('認証');
    });

    test('管理者権限なしでアクセスすると401エラーが返る', async () => {
      const token = createTestToken(false); // 管理者権限なし
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('権限');
    });

    test('正常な管理者認証でユーザー一覧が取得できる', async () => {
      const token = createTestToken(true); // 管理者権限あり
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    test('ページネーションパラメータが正しく処理される', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    test('検索パラメータが正しく処理される', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .get('/api/admin/users?search=admin')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // モック環境では 'admin' ユーザーが存在するはず
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    test('学年フィルタが正しく処理される', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .get('/api/admin/users?grade=4')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // 学年4のユーザーのみが返されることを確認
      response.body.data.users.forEach(user => {
        expect(user.grade).toBe(4);
      });
    });
  });

  describe('OPTIONS /api/admin/users', () => {
    test('CORS プリフライトリクエストが正しく処理される', async () => {
      const response = await request(app)
        .options('/api/admin/users');
      
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('無効なJWTトークンで401エラーが返る', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('無効');
    });

    test('不正なMethodで405エラーが返る', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(405);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Method not allowed');
    });
  });

  describe('Response Format', () => {
    test('レスポンス形式が正しい', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      
      // レスポンス構造の確認
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      
      // ページネーション構造の確認
      const pagination = response.body.data.pagination;
      expect(pagination).toHaveProperty('currentPage');
      expect(pagination).toHaveProperty('totalPages');
      expect(pagination).toHaveProperty('totalCount');
      expect(pagination).toHaveProperty('limit');
      
      // ユーザー情報の構造確認
      if (response.body.data.users.length > 0) {
        const user = response.body.data.users[0];
        expect(user).toHaveProperty('_id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('grade');
        expect(user).toHaveProperty('isAdmin');
        expect(user).toHaveProperty('totalChallenges');
        expect(user).toHaveProperty('averageCorrectRate');
      }
    });
  });
});