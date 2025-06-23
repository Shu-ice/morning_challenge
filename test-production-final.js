#!/usr/bin/env node

/**
 * 🚀 最終プロダクション動作テスト
 * 
 * URL: https://morningchallenge-pj6q05gsc-shu-ices-projects.vercel.app
 * 目標: admin@example.com で完全な管理者ダッシュボードアクセス
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://morningchallenge-pj6q05gsc-shu-ices-projects.vercel.app';

const tests = [
  {
    name: '🏥 Health Check',
    url: `${PRODUCTION_URL}/api/health`,
    method: 'GET',
    critical: false
  },
  {
    name: '🔐 Admin Login',
    url: `${PRODUCTION_URL}/api/simple-login`,
    method: 'POST',
    data: {
      email: 'admin@example.com',
      password: 'admin123'
    },
    critical: true,
    saveToken: true
  },
  {
    name: '📊 Admin Dashboard Access',
    url: `${PRODUCTION_URL}/api/admin-dashboard`,
    method: 'GET',
    critical: true,
    requiresAuth: true
  },
  {
    name: '🧮 Problems API',
    url: `${PRODUCTION_URL}/api/problems`,
    method: 'GET',
    critical: false,
    requiresAuth: true
  },
  {
    name: '⏰ Time Window API',
    url: `${PRODUCTION_URL}/api/time-window`,
    method: 'GET',
    critical: false
  }
];

let authToken = null;

async function runTest(test) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🧪 Testing: ${test.name} ${test.critical ? '(CRITICAL)' : ''}`);
    console.log(`📍 URL: ${test.url}`);
    
    const config = {
      method: test.method,
      url: test.url,
      timeout: 30000,
      headers: {
        'User-Agent': 'Production-Final-Test/1.0',
        'Content-Type': 'application/json'
      }
    };

    // 認証が必要な場合
    if (test.requiresAuth && authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
      console.log(`🔑 Using auth token: ${authToken.substring(0, 20)}...`);
    }

    if (test.data) {
      config.data = test.data;
      console.log(`📝 Data:`, JSON.stringify(test.data));
    }

    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    
    // ログイン成功時にトークンを保存
    if (test.saveToken && response.data.success && response.data.token) {
      authToken = response.data.token;
      console.log(`🎫 Auth token saved: ${authToken.substring(0, 20)}...`);
    }
    
    // 特別な成功チェック
    if (response.data.success) {
      if (test.name.includes('Login') && response.data.user) {
        const user = response.data.user;
        console.log(`🎉 LOGIN SUCCESS!`);
        console.log(`👤 User: ${user.username} (${user.email})`);
        console.log(`👑 Admin: ${user.isAdmin}`);
        console.log(`🎯 Grade: ${user.grade}`);
      }
      
      if (test.name.includes('Dashboard') && response.data.data) {
        console.log(`🎉 DASHBOARD ACCESS SUCCESS!`);
        console.log(`📊 System Health: ${response.data.data.systemHealth?.status}`);
        console.log(`👥 Total Users: ${response.data.data.userStats?.totalUsers}`);
        console.log(`📈 Today's Challenges: ${response.data.data.challengeStats?.challengesToday}`);
      }
    }
    
    return { 
      success: true, 
      test: test.name, 
      duration, 
      data: response.data,
      critical: test.critical,
      status: response.status
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Failed: ${test.name} ${test.critical ? '(CRITICAL FAILURE)' : ''}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      
      // Vercel認証エラーのチェック
      if (error.response.status === 401 && 
          typeof error.response.data === 'string' && 
          error.response.data.includes('Authentication Required')) {
        console.log(`🚨 VERCEL AUTHENTICATION WALL DETECTED!`);
        console.log(`🚨 This might indicate Vercel project protection is enabled`);
      }
      
      const responseText = typeof error.response.data === 'string' 
        ? error.response.data.substring(0, 300) + '...'
        : JSON.stringify(error.response.data, null, 2);
      
      console.log(`📊 Response:`, responseText);
      
      return { 
        success: false, 
        test: test.name, 
        duration,
        status: error.response.status,
        error: error.response.data,
        critical: test.critical
      };
    } else {
      console.log(`📊 Error:`, error.message);
      return { 
        success: false, 
        test: test.name, 
        duration,
        error: error.message,
        critical: test.critical
      };
    }
  }
}

async function runAllTests() {
  console.log('🚀 朝のチャレンジアプリ - 最終プロダクション動作テスト');
  console.log('🌐 URL:', PRODUCTION_URL);
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    // クリティカルテスト成功時は即座に報告
    if (test.critical && result.success) {
      console.log(`\n🎉 CRITICAL SUCCESS: ${test.name}`);
      
      if (test.name.includes('Login')) {
        console.log(`🎯 admin@example.com ログイン成功！`);
      }
      
      if (test.name.includes('Dashboard')) {
        console.log(`🎯 管理者ダッシュボードアクセス成功！`);
      }
    }
    
    // テスト間に1.5秒待機
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n📋 最終結果サマリー');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const criticalSuccess = results.filter(r => r.critical && r.success);
  const criticalFailed = results.filter(r => r.critical && !r.success);
  
  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  console.log(`❌ 失敗: ${failed.length}/${results.length}`);
  console.log(`🚨 Critical Success: ${criticalSuccess.length}/${results.filter(r => r.critical).length}`);
  console.log(`🚨 Critical Failed: ${criticalFailed.length}/${results.filter(r => r.critical).length}`);
  
  // 最終判定
  const loginSuccess = results.find(r => r.test.includes('Login') && r.success);
  const dashboardSuccess = results.find(r => r.test.includes('Dashboard') && r.success);
  
  if (loginSuccess && dashboardSuccess) {
    console.log('\n🎉🎉 COMPLETE SUCCESS! 🎉🎉');
    console.log('✅ admin@example.com ログイン成功');
    console.log('✅ 管理者ダッシュボードアクセス成功');
    console.log('✅ 朝のチャレンジアプリが正常に動作しています！');
    
    console.log('\n🚀 次のステップ:');
    console.log('1. ブラウザで直接アクセステスト');
    console.log('2. 時間制限設定の確認');
    console.log('3. 問題生成機能のテスト');
    
  } else if (criticalFailed.length === 0) {
    console.log('\n🎯 SUCCESS WITH MINOR ISSUES');
    console.log('✅ 重要な機能は全て動作');
    console.log('⚠️ 一部の非クリティカル機能に問題あり');
    
  } else {
    console.log('\n⚠️ CRITICAL ISSUES DETECTED');
    console.log('📝 以下の重要機能に問題があります:');
    
    criticalFailed.forEach(f => {
      console.log(`  - ${f.test}: ${f.error?.message || f.error || 'Unknown error'}`);
    });
    
    console.log('\n📊 推奨対策:');
    console.log('1. Vercel環境変数の確認');
    console.log('2. プロジェクト認証設定の確認');
    console.log('3. MongoDB Atlas接続の再確認');
  }
  
  console.log('\n🌐 プロダクションURL:');
  console.log(PRODUCTION_URL);
}

// メイン実行
runAllTests().catch(console.error);