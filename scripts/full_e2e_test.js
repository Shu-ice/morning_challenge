#!/usr/bin/env node
// 🚀 朝の計算チャレンジ E2E テストスクリプト
// 本番URL完全統合テスト

const axios = require('axios');

// 本番環境URL
const BASE_URL = process.env.BASE_URL || 'https://morningchallenge-8u5129p3n-shu-ices-projects.vercel.app';

// 管理者クレデンシャル
const ADMIN_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = null;
let testResults = {
  passed: 0,
  failed: 0,
  details: []
};

// テスト結果記録関数
function recordTest(testName, success, details = '') {
  if (success) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName} - ${details}`);
  }
  testResults.details.push({ test: testName, success, details });
}

// APIテスト関数
async function testAPI(endpoint, method = 'GET', data = null, headers = {}, expectedStatus = 200) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      return { success: true, data: response.data, status: response.status };
    } else {
      return { success: false, error: `Expected ${expectedStatus}, got ${response.status}`, status: response.status };
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
  
  // === Phase 5: エラーハンドリングテスト ===
  console.log('\n=== 🔍 Phase 5: エラーハンドリングテスト ===');
  
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