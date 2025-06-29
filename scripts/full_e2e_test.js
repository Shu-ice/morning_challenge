#!/usr/bin/env node
// 🚀 認証500エラー修正 E2E テストスクリプト
// Auth API 完全統合テスト

const axios = require('axios');

// テスト環境URL
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

const TEST_CONFIG = {
  timeout: 30000,
  retries: 3,
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
      throw error;
    }
  }

  // 認証API 500エラー防止テスト
  async testAuthLogin500Prevention() {
    return this.runTest('Auth Login 500 Error Prevention', async () => {
      // 有効な認証情報でテスト (200 期待)
      const validResponse = await this.client.post('/auth/login', TEST_CONFIG.testUser);
      
      if (validResponse.status >= 500) {
        throw new Error(`Auth API returned 500+ error: ${validResponse.status} - ${JSON.stringify(validResponse.data)}`);
      }

      // 無効な認証情報でテスト (401 期待、500 NG)
      const invalidResponse = await this.client.post('/auth/login', {
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.invalidPassword
      });

      if (invalidResponse.status >= 500) {
        throw new Error(`Auth API returned 500+ error for invalid credentials: ${invalidResponse.status}`);
      }

      // 存在しないユーザーでテスト (401 期待、500 NG)
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
        allNon500: [validResponse.status, invalidResponse.status, nonExistentResponse.status].every(s => s < 500)
      };
    });
  }

  // 複数同時リクエストテスト
  async testConcurrentAuthRequests() {
    return this.runTest('Concurrent Auth Requests', async () => {
      const promises = [];
      
      // 5つの同時認証リクエストを送信
      for (let i = 0; i < 5; i++) {
        promises.push(
          this.client.post('/auth/login', {
            email: `test${i}@example.com`,
            password: 'somepassword'
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // 500エラーが発生していないことを確認
      const serverErrors = responses.filter(r => r.status >= 500);
      
      if (serverErrors.length > 0) {
        throw new Error(`Found ${serverErrors.length} server errors (500+): ${JSON.stringify(serverErrors.map(r => ({ status: r.status, data: r.data })))}`);
      }

      return {
        totalRequests: responses.length,
        serverErrors: serverErrors.length,
        statusCodes: responses.map(r => r.status)
      };
    });
  }
  } catch (error) {
    const status = error.response?.status || 'NETWORK_ERROR';
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    
    if (status === expectedStatus) {
      return { success: true, data: error.response?.data, status };
    }
    
    return { 
      success: false, 
      error: errorMessage, 
      status,
      data: error.response?.data 
    };
  }
}

// メインE2Eテスト
async function runFullE2ETest() {
  console.log('🚀 朝の計算チャレンジ E2E テスト開始');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`👑 Admin: ${ADMIN_CREDENTIALS.email}`);
  console.log('━'.repeat(60));
  
  // === Phase 1: ログイン認証テスト ===
  console.log('\n=== 📋 Phase 1: ログイン認証テスト ===');
  
  const loginResult = await testAPI('/api/auth/login', 'POST', ADMIN_CREDENTIALS);
  
  if (loginResult.success && loginResult.data.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    recordTest('管理者ログイン', true, `Token取得成功: ${authToken.substring(0, 20)}...`);
    console.log(`🔑 認証トークン取得成功: ${authToken.substring(0, 30)}...`);
  } else {
    recordTest('管理者ログイン', false, loginResult.error || '認証失敗');
    console.log('❌ 認証失敗 - E2Eテストを中断します');
    return false;
  }
  
  const authHeaders = {
    'Authorization': `Bearer ${authToken}`
  };
  
  // === Phase 2: 管理者時間外アクセステスト ===
  console.log('\n=== ⏰ Phase 2: 管理者時間外アクセステスト ===');
  
  const timeWindowResult = await testAPI('/api/time-window', 'GET', null, authHeaders);
  if (timeWindowResult.success && timeWindowResult.data.timeWindow) {
    const timeWindow = timeWindowResult.data.timeWindow;
    recordTest('時間制限情報取得', true, `管理者バイパス: ${timeWindow.adminBypass}, アクセス可能: ${timeWindow.canAccess}`);
    
    if (timeWindow.canAccess || timeWindow.adminBypass || timeWindow.isAdmin) {
      recordTest('管理者時間制限バイパス', true, '管理者は時間制限を無視してアクセス可能');
    } else {
      recordTest('管理者時間制限バイパス', false, '管理者でも時間制限が適用されている');
    }
  } else {
    recordTest('時間制限情報取得', false, timeWindowResult.error);
  }
  
  // === Phase 3: 4つの難易度での問題生成テスト ===
  console.log('\n=== 📚 Phase 3: 全難易度問題生成テスト ===');
  
  const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
  
  for (const difficulty of difficulties) {
    console.log(`\n🎯 ${difficulty.toUpperCase()} 難易度テスト:`);
    
    const problemResult = await testAPI(`/api/problems?difficulty=${difficulty}`, 'GET', null, authHeaders);
    
    if (problemResult.success && problemResult.data.success && problemResult.data.problems) {
      const problems = problemResult.data.problems;
      const problemCount = problems.length;
      
      if (problemCount === 10) {
        recordTest(`${difficulty}問題生成(10問)`, true, `正常に${problemCount}問生成`);
        
        // 問題内容の検証
        let validProblems = 0;
        problems.forEach((problem, index) => {
          if (problem.question && Number.isFinite(problem.answer) && problem.id) {
            validProblems++;
          }
        });
        
        if (validProblems === problemCount) {
          recordTest(`${difficulty}問題内容検証`, true, `全${problemCount}問が有効な形式`);
          
          // 第1問の詳細表示
          const firstProblem = problems[0];
          console.log(`   📝 第1問: ${firstProblem.question} (答え: ${firstProblem.answer})`);
          
        } else {
          recordTest(`${difficulty}問題内容検証`, false, `${problemCount}問中${validProblems}問のみ有効`);
        }
        
      } else {
        recordTest(`${difficulty}問題生成(10問)`, false, `期待10問、実際${problemCount}問`);
      }
      
      // 管理者時間バイパス確認
      if (problemResult.data.timeWindow && problemResult.data.timeWindow.adminBypass) {
        recordTest(`${difficulty}管理者バイパス確認`, true, '時間制限がバイパスされている');
      } else {
        recordTest(`${difficulty}管理者バイパス確認`, false, '時間制限バイパスが無効');
      }
      
    } else {
      recordTest(`${difficulty}問題生成`, false, problemResult.error || '問題生成失敗');
    }
  }
  
  // === Phase 4: プロフィール・履歴テスト ===
  console.log('\n=== 👤 Phase 4: プロフィール・履歴テスト ===');
  
  // プロフィール取得
  const profileResult = await testAPI('/api/users/profile', 'GET', null, authHeaders);
  if (profileResult.success && profileResult.data.success && profileResult.data.user) {
    const user = profileResult.data.user;
    recordTest('プロフィール取得', true, `${user.username} (${user.email}), 学年: ${user.grade}`);
  } else {
    recordTest('プロフィール取得', false, profileResult.error);
  }
  
  // 履歴取得
  const historyResult = await testAPI('/api/history', 'GET', null, authHeaders);
  if (historyResult.success && historyResult.data.success) {
    const historyCount = historyResult.data.count || 0;
    recordTest('履歴取得', true, `履歴${historyCount}件取得成功`);
  } else {
    recordTest('履歴取得', false, historyResult.error);
  }
  
  // ランキング取得
  const rankingResult = await testAPI('/api/rankings', 'GET', null, authHeaders);
  if (rankingResult.success && rankingResult.data.success) {
    const rankingCount = rankingResult.data.count || 0;
    recordTest('ランキング取得', true, `ランキング${rankingCount}件取得成功`);
  } else {
    recordTest('ランキング取得', false, rankingResult.error);
  }
  
  // === Phase 4.5: 回答提出テスト ===
  console.log('\n=== 📝 Phase 4.5: 回答提出テスト ===');
  
  // Get problems for answer submission test
  const submitTestResult = await testAPI('/api/problems?difficulty=beginner', 'GET', null, authHeaders);
  if (submitTestResult.success && submitTestResult.data.problems) {
    const problems = submitTestResult.data.problems;
    const answers = problems.map(p => p.answer); // Use correct answers
    const problemIds = problems.map(p => p.id);
    
    const submissionData = {
      answers: answers,
      difficulty: 'beginner',
      date: new Date().toISOString().split('T')[0],
      problemIds: problemIds,
      timeSpentMs: 60000, // 1 minute
      startTime: Date.now() - 60000
    };
    
    const answerResult = await testAPI('/api/problems', 'POST', submissionData, authHeaders);
    if (answerResult.success && answerResult.data.success) {
      const results = answerResult.data.results;
      recordTest('回答提出', true, `スコア: ${results.score}%, 正解: ${results.correctAnswers}/${results.totalProblems}`);
    } else {
      recordTest('回答提出', false, answerResult.error || '提出失敗');
    }
  } else {
    recordTest('回答提出', false, '問題取得失敗のため回答提出テストをスキップ');
  }
  
  // === Phase 6: エラーハンドリングテスト ===
  console.log('\n=== 🔍 Phase 6: エラーハンドリングテスト ===');
  
  // 不正な難易度テスト
  const invalidDifficultyResult = await testAPI('/api/problems?difficulty=invalid', 'GET', null, authHeaders, 400);
  if (invalidDifficultyResult.success && invalidDifficultyResult.status === 400) {
    recordTest('不正難易度エラー処理', true, '400エラーを正常に返却');
  } else {
    recordTest('不正難易度エラー処理', false, `期待400, 実際${invalidDifficultyResult.status}`);
  }
  
  // 不正トークンテスト
  const invalidTokenResult = await testAPI('/api/users/profile', 'GET', null, { 'Authorization': 'Bearer invalid-token' }, 401);
  if (invalidTokenResult.success && invalidTokenResult.status === 401) {
    recordTest('不正トークンエラー処理', true, '401エラーを正常に返却');
  } else {
    recordTest('不正トークンエラー処理', false, `期待401, 実際${invalidTokenResult.status}`);
  }
  
  return true;
}

// テスト結果サマリー表示
function displayTestSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('🎯 E2Eテスト結果サマリー');
  console.log('='.repeat(60));
  console.log(`✅ 成功: ${testResults.passed} テスト`);
  console.log(`❌ 失敗: ${testResults.failed} テスト`);
  console.log(`📊 成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ 失敗したテスト:');
    testResults.details
      .filter(test => !test.success)
      .forEach(test => {
        console.log(`   • ${test.test}: ${test.details}`);
      });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (testResults.failed === 0) {
    console.log('🎉 全てのテストが成功しました！');
    console.log('✅ 朝の計算チャレンジAPIは正常に動作しています');
    return true;
  } else {
    console.log('⚠️  一部のテストが失敗しました');
    console.log('🔧 上記の失敗項目を確認してください');
    return false;
  }
}

// メイン実行
async function main() {
  try {
    const success = await runFullE2ETest();
    const allTestsPassed = displayTestSummary();
    
    process.exit(allTestsPassed ? 0 : 1);
    
  } catch (error) {
    console.error('💥 E2Eテスト実行エラー:', error.message);
    process.exit(1);
  }
}

// プログラム実行
if (require.main === module) {
  main();
}

module.exports = { runFullE2ETest, testAPI };