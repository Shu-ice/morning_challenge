#!/usr/bin/env node

/**
 * CRITICAL: Vercel FUNCTION_INVOCATION_FAILED 根本解決テスト
 * 
 * 抜本的修正内容:
 * 1. package.json - "type": "module" を削除
 * 2. 純粋なVercel Functions形式のエンドポイント作成
 * 3. CommonJS形式に統一
 * 4. Express.js依存を排除した独立エンドポイント
 */

const axios = require('axios');

const VERCEL_URL = 'https://morningchallenge-mr1copspp-shu-ices-projects.vercel.app';

const tests = [
  {
    name: 'Pure Health Check (No Dependencies)',
    url: `${VERCEL_URL}/api/health`,
    method: 'GET',
    critical: true
  },
  {
    name: 'Environment Variables (Pure Function)',
    url: `${VERCEL_URL}/api/env-test`,
    method: 'GET',
    critical: true
  },
  {
    name: 'Simple Login (Hardcoded Auth)',
    url: `${VERCEL_URL}/api/simple-login`,
    method: 'POST',
    data: {
      email: 'admin@example.com',
      password: 'admin123'
    },
    critical: true
  },
  {
    name: 'Original Express.js Health (Legacy)',
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
      timeout: 30000, // 30秒タイムアウト
      headers: {
        'User-Agent': 'Critical-Fix-Test/1.0',
        'Content-Type': 'application/json'
      }
    };

    if (test.data) {
      config.data = test.data;
    }

    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    
    return { 
      success: true, 
      test: test.name, 
      duration, 
      data: response.data,
      critical: test.critical 
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Failed: ${test.name} ${test.critical ? '(CRITICAL FAILURE)' : ''}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      
      // FUNCTION_INVOCATION_FAILEDエラーの詳細チェック
      if (error.response.status === 500 && error.response.data?.includes?.('FUNCTION_INVOCATION_FAILED')) {
        console.log(`🚨 CRITICAL: FUNCTION_INVOCATION_FAILED detected!`);
        console.log(`🚨 Error ID: ${error.response.data.match(/Error ID: ([a-z0-9]+)/)?.[1] || 'Not found'}`);
      }
      
      const responseText = typeof error.response.data === 'string' 
        ? error.response.data.substring(0, 500) + '...'
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
  console.log('🚨 CRITICAL: Vercel FUNCTION_INVOCATION_FAILED 根本解決テスト');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    // クリティカルテスト失敗時は即座に報告
    if (test.critical && !result.success) {
      console.log(`\n🚨 CRITICAL TEST FAILED: ${test.name}`);
      console.log(`🚨 This indicates the root cause is NOT yet resolved.`);
    }
    
    // テスト間に2秒待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📋 最終結果サマリー');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const criticalSuccess = results.filter(r => r.critical && r.success);
  const criticalFailed = results.filter(r => r.critical && !r.success);
  
  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  console.log(`❌ 失敗: ${failed.length}/${results.length}`);
  console.log(`🚨 Critical Success: ${criticalSuccess.length}/${results.filter(r => r.critical).length}`);
  console.log(`🚨 Critical Failed: ${criticalFailed.length}/${results.filter(r => r.critical).length}`);
  
  if (criticalFailed.length === 0) {
    console.log('\n🎉 CRITICAL SUCCESS: FUNCTION_INVOCATION_FAILEDエラー解決！');
    console.log('✅ 純粋なVercel Functions が正常に動作しています');
    console.log('✅ admin@example.com ログインも成功');
  } else {
    console.log('\n⚠️ CRITICAL FAILURE: 根本問題が残存');
    console.log('📝 更なる抜本的対策が必要です');
    
    criticalFailed.forEach(f => {
      console.log(`  - ${f.test}: ${f.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n📊 推奨次回アクション:');
  if (criticalFailed.length === 0) {
    console.log('1. Vercelダッシュボードでデプロイログ確認');
    console.log('2. ブラウザで実際のログインテスト');
    console.log('3. 段階的にExpress.js機能を復活');
  } else {
    console.log('1. Next.js への完全移行を検討');
    console.log('2. 依存関係の完全見直し');
    console.log('3. Vercelサポートへの問い合わせ');
  }
}

// メイン実行
runAllTests().catch(console.error);