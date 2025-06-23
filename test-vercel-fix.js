#!/usr/bin/env node

/**
 * Vercel本番環境修正後のテストスクリプト
 * 
 * 修正内容:
 * 1. vercel.json - タイムアウト20秒→30秒に延長
 * 2. database.js - MongoDB接続の最適化とタイムアウト設定
 * 3. app.js - 接続ミドルウェアにタイムアウト保護を追加
 * 4. api/express.js - シンプルな形式に戻す
 */

import axios from 'axios';

const VERCEL_URL = 'https://morningchallenge-r8w69gzgm-shu-ices-projects.vercel.app';

const tests = [
  {
    name: 'Health Check',
    url: `${VERCEL_URL}/api/health`,
    method: 'GET'
  },
  {
    name: 'MongoDB Connection Test',
    url: `${VERCEL_URL}/api/test/mongodb-test`,
    method: 'GET'
  },
  {
    name: 'Environment Variables Test',
    url: `${VERCEL_URL}/api/test/env-test`,
    method: 'GET'
  }
];

async function runTest(test) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`📍 URL: ${test.url}`);
    
    const response = await axios({
      method: test.method,
      url: test.url,
      timeout: 45000, // 45秒タイムアウト
      headers: {
        'User-Agent': 'Vercel-Fix-Test/1.0'
      }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    
    return { success: true, test: test.name, duration, data: response.data };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Failed: ${test.name}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📊 Response:`, JSON.stringify(error.response.data, null, 2));
      return { 
        success: false, 
        test: test.name, 
        duration,
        status: error.response.status,
        error: error.response.data 
      };
    } else {
      console.log(`📊 Error:`, error.message);
      return { 
        success: false, 
        test: test.name, 
        duration,
        error: error.message 
      };
    }
  }
}

async function runAllTests() {
  console.log('🚀 Vercel本番環境修正テスト開始');
  console.log('='.repeat(50));
  
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    // テスト間に1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 テスト結果サマリー');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  console.log(`❌ 失敗: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ 失敗したテスト:');
    failed.forEach(f => {
      console.log(`  - ${f.test}: ${f.error || 'Unknown error'}`);
    });
  }
  
  if (successful.length === results.length) {
    console.log('\n🎉 すべてのテストが成功しました！');
    console.log('✅ FUNCTION_INVOCATION_FAILEDエラーが解決されました');
  } else {
    console.log('\n⚠️ 一部のテストが失敗しています');
    console.log('📝 詳細なログはVercelダッシュボードで確認してください');
  }
}

// メイン実行
runAllTests().catch(console.error);