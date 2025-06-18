import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';
import DailyProblemSet from '../models/DailyProblemSet.js';

describe('Problems API Tests', () => {
  let authToken;
  let userId;
  const testUser = {
    username: 'problemtester',
    email: 'problems@example.com',
    password: 'testpassword123',
    grade: 6
  };

  beforeEach(async () => {
    // テスト用ユーザーを作成
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    authToken = registerResponse.body.token;
    userId = registerResponse.body.user._id;

    // テスト用問題セットを作成
    const testProblems = [
      {
        id: 'test1',
        question: '2 + 3 = ?',
        answer: 5,
        type: 'addition'
      },
      {
        id: 'test2', 
        question: '7 - 4 = ?',
        answer: 3,
        type: 'subtraction'
      },
      {
        id: 'test3',
        question: '3 × 4 = ?',
        answer: 12,
        type: 'multiplication'
      }
    ];

    const today = new Date().toISOString().split('T')[0];
    await DailyProblemSet.create({
      date: today,
      difficulty: 'beginner',
      problems: testProblems,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  describe('GET /api/problems', () => {
    test('should get problems for authenticated user', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get('/api/problems')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          difficulty: 'beginner',
          date: today
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.problems).toBeDefined();
      expect(Array.isArray(response.body.problems)).toBe(true);
      expect(response.body.problems.length).toBeGreaterThan(0);
      
      // 問題の構造をチェック
      const problem = response.body.problems[0];
      expect(problem).toHaveProperty('id');
      expect(problem).toHaveProperty('question');
      expect(problem).toHaveProperty('answer');
    });

    test('should require authentication', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get('/api/problems')
        .query({
          difficulty: 'beginner',
          date: today
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('認証トークンが必要です');
    });

    test('should validate difficulty parameter', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get('/api/problems')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          difficulty: 'invalid',
          date: today
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('無効な難易度');
    });

    test('should handle missing problems for date', async () => {
      const futureDate = '2030-12-31';
      
      const response = await request(app)
        .get('/api/problems')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          difficulty: 'beginner',
          date: futureDate
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('問題が見つかりませんでした');
    });
  });

  describe('POST /api/problems/submit', () => {
    test('should submit answers successfully', async () => {
      const today = new Date().toISOString().split('T')[0];
      const startTime = Date.now() - 60000; // 1分前
      const endTime = Date.now();
      
      const submissionData = {
        answers: ['5', '3', '12'],
        startTime,
        endTime,
        difficulty: 'beginner',
        date: today
      };

      const response = await request(app)
        .post('/api/problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(response.body.results.totalProblems).toBe(3);
      expect(response.body.results.correctAnswers).toBe(3);
      expect(response.body.results.score).toBeGreaterThan(0);
      expect(response.body.results.problems).toBeDefined();
      expect(Array.isArray(response.body.results.problems)).toBe(true);
    });

    test('should calculate partial scores correctly', async () => {
      const today = new Date().toISOString().split('T')[0];
      const startTime = Date.now() - 60000;
      const endTime = Date.now();
      
      const submissionData = {
        answers: ['5', '99', '12'], // 1つ間違い
        startTime,
        endTime,
        difficulty: 'beginner',
        date: today
      };

      const response = await request(app)
        .post('/api/problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results.totalProblems).toBe(3);
      expect(response.body.results.correctAnswers).toBe(2);
      expect(response.body.results.incorrectAnswers).toBe(1);
      
      const problems = response.body.results.problems;
      expect(problems[0].isCorrect).toBe(true);
      expect(problems[1].isCorrect).toBe(false);
      expect(problems[2].isCorrect).toBe(true);
    });

    test('should require authentication for submission', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const submissionData = {
        answers: ['5', '3', '12'],
        startTime: Date.now() - 60000,
        endTime: Date.now(),
        difficulty: 'beginner',
        date: today
      };

      const response = await request(app)
        .post('/api/problems/submit')
        .send(submissionData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('認証トークンが必要です');
    });

    test('should validate submission data', async () => {
      const invalidSubmission = {
        answers: [], // 空の回答
        difficulty: 'beginner'
        // startTime, endTime, date が欠如
      };

      const response = await request(app)
        .post('/api/problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSubmission)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });
});