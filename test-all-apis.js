#!/usr/bin/env node
// 🚀 朝の計算チャレンジAPI統合テストスクリプト
// MongoDB Atlas & Vercel本番環境対応版

const axios = require('axios');

// 本番環境URL
const BASE_URL = 'https://morningchallenge-4xs1ovufu-shu-ices-projects.vercel.app';

// テスト用の管理者クレデンシャル
const ADMIN_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = null;

// APIテスト関数
async function testAPI(endpoint, method = 'GET', data = null, headers = {}) {
  try {
    console.log(`\n🔍 Testing: ${method} ${endpoint}`);
    
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
    console.log(`✅ ${endpoint}: ${response.status} - ${response.statusText}`);
    
    if (response.data) {
      if (response.data.success !== undefined) {
        console.log(`   Success: ${response.data.success}`);
      }
      if (response.data.message) {
        console.log(`   Message: ${response.data.message}`);
      }
      if (response.data.user) {
        console.log(`   User: ${response.data.user.username} (${response.data.user.email})`);
      }
      if (response.data.count !== undefined) {
        console.log(`   Count: ${response.data.count}`);
      }
    }
    
    return response.data;
    
  } catch (error) {
    console.log(`❌ ${endpoint}: ${error.response?.status || 'ERROR'} - ${error.response?.statusText || error.message}`);
    
    if (error.response?.data) {
      console.log(`   Error: ${error.response.data.error || error.response.data.message || 'Unknown error'}`);
    }
    
    return null;
  }
}

// メイン統合テスト
async function runAllTests() {
  console.log('🚀 朝の計算チャレンジAPI統合テスト開始');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`👑 Admin: ${ADMIN_CREDENTIALS.email}`);
  
  console.log('\n=== 📋 Phase 1: Authentication Tests ===');
  
  // 1. ログインテスト
  const loginResult = await testAPI('/api/auth/login', 'POST', ADMIN_CREDENTIALS);
  
  if (loginResult && loginResult.success && loginResult.token) {
    authToken = loginResult.token;
    console.log('🔑 認証トークン取得成功');
  } else {
    console.log('❌ 認証失敗 - 以降のテストはスキップされます');
    return;
  }
  
  const authHeaders = {
    'Authorization': `Bearer ${authToken}`
  };
  
  console.log('\n=== 👤 Phase 2: Profile Management Tests ===');
  
  // 2. プロフィール取得テスト
  await testAPI('/api/users/profile', 'GET', null, authHeaders);
  
  // 3. プロフィール更新テスト（学年変更）
  const profileUpdateData = {
    username: 'admin',
    grade: 6,
    avatar: '👑'
  };
  await testAPI('/api/users/profile', 'PUT', profileUpdateData, authHeaders);
  
  // 4. 学年7（その他）テスト
  await testAPI('/api/users/profile', 'PUT', { grade: 7 }, authHeaders);
  
  // 5. 学年999（ひみつ）テスト
  await testAPI('/api/users/profile', 'PUT', { grade: 999 }, authHeaders);
  
  console.log('\n=== ⏰ Phase 3: Time Window Tests ===');
  
  // 6. 時間制限チェック
  await testAPI('/api/time-window', 'GET', null, authHeaders);
  
  console.log('\n=== 📚 Phase 4: Problems API Tests ===');
  
  // 7. 問題生成テスト（各難易度）
  const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
  
  for (const difficulty of difficulties) {
    await testAPI(`/api/problems?difficulty=${difficulty}`, 'GET', null, authHeaders);
  }
  
  // 8. 問題回答提出テスト
  const answerData = {
    answers: ['30', '40', '50', '60', '70', '80', '90', '100', '110', '120'],
    timeToComplete: 60000,
    difficulty: 'beginner'
  };
  await testAPI('/api/problems', 'POST', answerData, authHeaders);
  
  console.log('\n=== 🏆 Phase 5: Rankings & History Tests ===');
  
  // 9. ランキング取得テスト
  await testAPI('/api/rankings', 'GET', null, authHeaders);
  
  // 10. 履歴取得テスト
  await testAPI('/api/history', 'GET', null, authHeaders);
  
  console.log('\n=== 🛠️ Phase 6: Admin Functions Tests ===');
  
  // 11. 管理者ダッシュボードテスト
  await testAPI('/api/admin-dashboard', 'GET', null, authHeaders);
  
  // 12. 管理者統計テスト
  await testAPI('/api/admin-stats', 'GET', null, authHeaders);
  
  // 13. 時間制限設定テスト
  const timeWindowUpdate = {
    start: '06:30',
    end: '08:00',
    adminBypass: true
  };
  await testAPI('/api/time-window', 'POST', timeWindowUpdate, authHeaders);
  
  console.log('\n=== 🔍 Phase 7: Error Handling Tests ===');
  
  // 14. 不正な認証テスト
  await testAPI('/api/users/profile', 'GET', null, { 'Authorization': 'Bearer invalid-token' });
  
  // 15. 存在しないエンドポイントテスト
  await testAPI('/api/nonexistent', 'GET');
  
  // 16. 不正な学年テスト
  await testAPI('/api/users/profile', 'PUT', { grade: 15 }, authHeaders);
  
  console.log('\n=== ✅ テスト完了 ===');
  console.log('🎯 全APIエンドポイントのテストが完了しました');
  console.log('📊 詳細な結果は上記のログを確認してください');
  console.log('\n📝 次のステップ:');
  console.log('1. 失敗したAPIがあれば個別に修正');
  console.log('2. Vercelにデプロイしてテスト');
  console.log('3. フロントエンドとの統合テスト');
}

// プログラム実行
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 テスト実行エラー:', error.message);
    process.exit(1);
  });
}

module.exports = { runAllTests, testAPI };