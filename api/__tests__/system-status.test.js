// API Tests for System Status Endpoint
// /api/system/status のテスト

const request = require('supertest');
const jwt = require('jsonwebtoken');

// モックアプリケーション（Express風）
const createMockApp = () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  // System status API をモック
  const systemStatusHandler = require('../system/status');
  app.get('/api/system/status', (req, res) => systemStatusHandler(req, res));
  
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

describe('/api/system/status API Tests', () => {
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

  describe('GET /api/system/status', () => {
    test('認証なしでアクセスすると401エラーが返る', async () => {
      const response = await request(app)
        .get('/api/system/status');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('認証');
    });

    test('管理者権限なしでアクセスすると401エラーが返る', async () => {
      const token = createTestToken(false); // 管理者権限なし
      
      const response = await request(app)
        .get('/api/system/status')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('権限');
    });

    test('正常な管理者認証でシステム状態が取得できる', async () => {
      const token = createTestToken(true); // 管理者権限あり
      
      const response = await request(app)
        .get('/api/system/status')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('health');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('performance');
    }, 10000); // タイムアウトを10秒に設定
  });

  describe('OPTIONS /api/system/status', () => {
    test('CORS プリフライトリクエストが正しく処理される', async () => {
      const response = await request(app)
        .options('/api/system/status');
      
      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    test('レスポンス形式が正しい', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .get('/api/system/status')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      
      // 基本構造の確認
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('health');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('checkDuration');
      
      // ステータス構造の確認
      const status = response.body.status;
      expect(status).toHaveProperty('isHealthy');
      expect(status).toHaveProperty('statusLevel');
      expect(status).toHaveProperty('summary');
      expect(status).toHaveProperty('recommendations');
      expect(Array.isArray(status.recommendations)).toBe(true);
      
      // ヘルスチェック構造の確認
      const health = response.body.health;
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('summary');
      
      // システム情報構造の確認
      const system = response.body.system;
      expect(system).toHaveProperty('process');
      expect(system).toHaveProperty('system');
      expect(system).toHaveProperty('time');
      expect(system).toHaveProperty('environment');
      
      // パフォーマンス情報構造の確認
      const performance = response.body.performance;
      expect(performance).toHaveProperty('responseTime');
      expect(performance).toHaveProperty('memoryUsage');
      expect(performance).toHaveProperty('cpuUsage');
    }, 10000);

    test('ヘルスチェック結果にコンポーネント情報が含まれる', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .get('/api/system/status')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      
      const components = response.body.health.components;
      
      // 必要なコンポーネントが存在することを確認
      expect(components).toHaveProperty('database');
      expect(components).toHaveProperty('memory');
      expect(components).toHaveProperty('process');
      
      // 各コンポーネントの構造確認
      Object.values(components).forEach(component => {
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('isHealthy');
        expect(typeof component.isHealthy).toBe('boolean');
      });
    }, 10000);

    test('システム環境情報が正しく取得される', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .get('/api/system/status')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      
      const environment = response.body.system.environment;
      
      expect(environment).toHaveProperty('mongoMock', true);
      expect(environment).toHaveProperty('nodeEnv');
      expect(environment).toHaveProperty('timeCheckDisabled');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('無効なJWTトークンで401エラーが返る', async () => {
      const response = await request(app)
        .get('/api/system/status')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('無効');
    });

    test('不正なMethodで405エラーが返る', async () => {
      const token = createTestToken(true);
      
      const response = await request(app)
        .post('/api/system/status')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(405);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Method not allowed');
    });
  });

  describe('Performance', () => {
    test('レスポンス時間が妥当な範囲内である', async () => {
      const token = createTestToken(true);
      
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/system/status')
        .set('Authorization', `Bearer ${token}`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(10000); // 10秒以内
      expect(response.body.checkDuration).toBeLessThan(10000); // サーバーサイドの処理時間も10秒以内
    }, 15000);
  });
});