#!/usr/bin/env node

/**
 * Auth 500 Error Fix E2E Test
 * 認証API 500エラー修正の完全検証
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

const TEST_CONFIG = {
  timeout: 30000,
  testUser: {
    email: 'admin@example.com',
    password: 'admin123',
    invalidPassword: 'wrongpassword'
  }
};

class AuthTestRunner {
  constructor() {
    this.results = [];
    this.client = axios.create({
      baseURL: API_URL,
      timeout: TEST_CONFIG.timeout,
      validateStatus: () => true // Don't throw on 4xx/5xx
    });
  }

  async runTest(name, testFn) {
    console.log(`🧪 Testing: ${name}`);
    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        status: 'PASS',
        duration,
        details: result
      });
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
      return result;
    } catch (error) {
      this.results.push({
        name,
        status: 'FAIL',
        error: error.message,
        details: error.response?.data
      });
      console.log(`❌ ${name} - FAILED: ${error.message}`);
      return null;
    }
  }

  // 認証API 500エラー防止テスト
  async testAuthLogin500Prevention() {
    return this.runTest('Auth Login 500 Error Prevention', async () => {
      // 有効な認証情報でテスト
      const validResponse = await this.client.post('/auth/login', TEST_CONFIG.testUser);
      
      if (validResponse.status >= 500) {
        throw new Error(`Auth API returned 500+ error: ${validResponse.status} - ${JSON.stringify(validResponse.data)}`);
      }

      // 無効な認証情報でテスト
      const invalidResponse = await this.client.post('/auth/login', {
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.invalidPassword
      });

      if (invalidResponse.status >= 500) {
        throw new Error(`Auth API returned 500+ error for invalid credentials: ${invalidResponse.status}`);
      }

      // 存在しないユーザーでテスト
      const nonExistentResponse = await this.client.post('/auth/login', {
        email: 'nonexistent@example.com',
        password: 'anypassword'
      });

      if (nonExistentResponse.status >= 500) {
        throw new Error(`Auth API returned 500+ error for non-existent user: ${nonExistentResponse.status}`);
      }

      return {
        validAuth: validResponse.status,
        invalidAuth: invalidResponse.status,
        nonExistent: nonExistentResponse.status,
        allNon500: true
      };
    });
  }

  // 複数同時リクエストテスト
  async testConcurrentAuthRequests() {
    return this.runTest('Concurrent Auth Requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          this.client.post('/auth/login', {
            email: `test${i}@example.com`,
            password: 'somepassword'
          })
        );
      }

      const responses = await Promise.all(promises);
      
      const serverErrors = responses.filter(r => r.status >= 500);
      
      if (serverErrors.length > 0) {
        throw new Error(`Found ${serverErrors.length} server errors (500+)`);
      }

      return {
        totalRequests: responses.length,
        serverErrors: serverErrors.length,
        statusCodes: responses.map(r => r.status)
      };
    });
  }

  // API正常性チェック
  async testAPIHealth() {
    return this.runTest('API Health Check', async () => {
      const response = await this.client.get('/health');

      if (response.status >= 500) {
        throw new Error(`Health API returned 500+ error: ${response.status}`);
      }

      return {
        status: response.status,
        healthy: response.status === 200
      };
    });
  }

  // メイン実行
  async run() {
    console.log(`🚀 Starting Auth 500 Error Fix Tests`);
    console.log(`🎯 Target: ${BASE_URL}`);
    console.log('');

    // 必須テスト実行
    await this.testAPIHealth();
    await this.testAuthLogin500Prevention();
    await this.testConcurrentAuthRequests();

    // 結果サマリー
    this.printSummary();
    
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    
    if (failedTests.length > 0) {
      console.log('\\n💥 Failed tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
      return false;
    }

    console.log('\\n🎉 All Auth 500 error fix tests passed!');
    return true;
  }

  printSummary() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log('\\n📊 Test Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total time: ${totalDuration}ms`);
  }
}

// CLI実行
if (require.main === module) {
  const runner = new AuthTestRunner();
  runner.run()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Auth test runner error:', error);
      process.exit(1);
    });
}

module.exports = AuthTestRunner;