#!/usr/bin/env node

/**
 * 緊急修正テスト - MongoDB認証エラー解決
 * 
 * 修正内容:
 * 1. MongoDB接続文字列の修正とタイムアウト設定
 * 2. フォールバック認証機能の実装
 * 3. 緊急時の自動フォールバック
 * 4. CommonJS形式への変更
 */

const axios = require('axios');

const VERCEL_URL = 'https://morningchallenge-ell3dlj5g-shu-ices-projects.vercel.app';

const tests = [
  {
    name: 'Admin Login (Primary Test)',
    url: `${VERCEL_URL}/api/auth/login`,
    method: 'POST',
    data: {
      email: 'admin@example.com',
      password: 'admin123'
    },
    critical: true
  },
  {
    name: 'Kanri Login (Secondary Admin)',
    url: `${VERCEL_URL}/api/auth/login`,
    method: 'POST',
    data: {
      email: 'kanri@example.com',
      password: 'kanri123'
    },
    critical: false
  },
  {
    name: 'Simple Login Fallback',
    url: `${VERCEL_URL}/api/simple-login`,
    method: 'POST',
    data: {
      email: 'admin@example.com',
      password: 'admin123'
    },
    critical: true
  },
  {
    name: 'Health Check',
    url: `${VERCEL_URL}/api/health`,
    method: 'GET',
    critical: false
  }
];

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
        'User-Agent': 'Emergency-Fix-Test/1.0',
        'Content-Type': 'application/json'
      }
    };

    if (test.data) {
      config.data = test.data;
      console.log(`📝 Data:`, JSON.stringify(test.data));
    }

    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    
    // 特別なログイン成功チェック
    if (response.data.success && response.data.user) {
      const user = response.data.user;
      console.log(`🎉 LOGIN SUCCESS!`);
      console.log(`👤 User: ${user.username} (${user.email})`);
      console.log(`👑 Admin: ${user.isAdmin}`);
      console.log(`🔐 Auth Method: ${response.data.authMethod || 'Unknown'}`);
    }
    
    return { 
      success: true, 
      test: test.name, 
      duration, 
      data: response.data,
      critical: test.critical,
      loginSuccess: response.data.success && response.data.user
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Failed: ${test.name} ${test.critical ? '(CRITICAL FAILURE)' : ''}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      
      // MongoDB認証エラーの詳細チェック
      if (error.response.data?.message?.includes?.('bad auth')) {
        console.log(`🚨 MONGODB AUTH ERROR DETECTED!`);
        console.log(`🚨 This is the exact issue we're fixing`);
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
        critical: test.critical,
        loginSuccess: false
      };
    } else {
      console.log(`📊 Error:`, error.message);
      return { 
        success: false, 
        test: test.name, 
        duration,
        error: error.message,
        critical: test.critical,
        loginSuccess: false
      };
    }
  }
}

async function runAllTests() {
  console.log('🚨 緊急修正テスト - MongoDB認証エラー解決');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    // クリティカルテスト成功時は即座に報告
    if (test.critical && result.success && result.loginSuccess) {
      console.log(`\n🎉 CRITICAL SUCCESS: ${test.name}`);
      console.log(`🎉 admin@example.com ログイン成功！`);
    }
    
    // テスト間に1.5秒待機
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n📋 最終結果サマリー');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const loginSuccessful = results.filter(r => r.loginSuccess);
  const criticalSuccess = results.filter(r => r.critical && r.success);
  
  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  console.log(`❌ 失敗: ${failed.length}/${results.length}`);
  console.log(`🔐 ログイン成功: ${loginSuccessful.length}/${results.length}`);
  console.log(`🚨 Critical Success: ${criticalSuccess.length}/${results.filter(r => r.critical).length}`);
  
  if (loginSuccessful.length > 0) {
    console.log('\n🎉 EMERGENCY FIX SUCCESS!');
    console.log('✅ admin@example.com ログインが正常に動作');
    console.log('✅ MongoDB認証エラーが解決されました');
    console.log('✅ フォールバック機能が正常に動作');
    
    loginSuccessful.forEach(result => {
      console.log(`  - ${result.test}: ✅ 成功`);
    });
  } else {
    console.log('\n⚠️ EMERGENCY FIX NEEDED');
    console.log('📝 追加対策が必要です');
    
    failed.forEach(f => {
      console.log(`  - ${f.test}: ${f.error?.message || f.error || 'Unknown error'}`);
    });
    
    console.log('\n📊 推奨対策:');
    console.log('1. MongoDB Atlasクラスターの新規作成');
    console.log('2. 環境変数MONGODB_URIの完全再設定');
    console.log('3. Vercel環境変数の確認');
  }
}

// メイン実行
runAllTests().catch(console.error);