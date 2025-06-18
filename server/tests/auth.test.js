import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';

describe('Auth API Tests', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'testpassword123',
    grade: 6
  };

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ユーザー登録が完了しました。');
      expect(response.body.user).toHaveProperty('_id');
      expect(response.body.user.username).toBe(testUser.username);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body).toHaveProperty('token');

      // データベースにユーザーが作成されたことを確認
      const savedUser = await User.findOne({ email: testUser.email });
      expect(savedUser).toBeTruthy();
      expect(savedUser.username).toBe(testUser.username);
    });

    test('should not register user with duplicate email', async () => {
      // 最初のユーザーを作成
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // 同じメールアドレスで再度登録を試行
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('すでに登録されています');
    });

    test('should validate required fields', async () => {
      const invalidUser = {
        username: '',
        email: 'invalid-email',
        password: '123' // too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // テスト用ユーザーを作成
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ログインしました。');
      expect(response.body.user).toHaveProperty('_id');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body).toHaveProperty('token');
    });

    test('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('メールアドレスまたはパスワードが正しくありません');
    });

    test('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('メールアドレスまたはパスワードが正しくありません');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;

    beforeEach(async () => {
      // ユーザー登録とログイン
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      authToken = registerResponse.body.token;
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('_id');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.username).toBe(testUser.username);
    });

    test('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('認証トークンが必要です');
    });

    test('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('無効なトークンです');
    });
  });
});