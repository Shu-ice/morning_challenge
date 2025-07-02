// Test Setup for API Tests
// APIテストの共通設定

// 環境変数の設定
process.env.NODE_ENV = 'test';
process.env.MONGODB_MOCK = 'true';
process.env.JWT_SECRET = 'test-jwt-secret-key';

// タイムアウト設定
jest.setTimeout(15000); // 15秒

// コンソール出力の抑制（必要に応じて）
if (process.env.SUPPRESS_LOGS === 'true') {
  console.log = jest.fn();
  console.debug = jest.fn();
  console.info = jest.fn();
}

// テスト後のクリーンアップ
afterEach(() => {
  // モック関数のリセット
  jest.clearAllMocks();
});

// グローバルテストヘルパー
global.testUtils = {
  // レスポンス形式の共通検証
  expectSuccessResponse: (response) => {
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
  },

  expectErrorResponse: (response, statusCode = 400) => {
    expect(response.status).toBe(statusCode);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  },

  // JWTトークン生成ヘルパー
  createJWT: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    const defaultPayload = {
      userId: 'test-user-id',
      isAdmin: true,
      ...payload
    };
    return jwt.sign(defaultPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
  }
};

console.log('🧪 API Test setup completed');