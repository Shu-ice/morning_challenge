#!/usr/bin/env node

/**
 * Vercel API履歴ページング機能テストスクリプト
 * api/history.js のページング機能をテスト
 */

const axios = require('axios');

// 設定
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-token';

console.log(`🌐 Testing API at: ${BASE_URL}`);
console.log(`🔑 Using token: ${TEST_TOKEN ? 'Provided' : 'Not provided'}\n`);

// テストケース
const testCases = [
  {
    name: 'デフォルト（パラメータなし）',
    url: '/history',
    expected: { limit: 10, offset: 0 },
    description: 'Should return first 10 records with default pagination'
  },
  {
    name: 'limit=5, offset=0',
    url: '/history?limit=5&offset=0',
    expected: { limit: 5, offset: 0 },
    description: 'Should return first 5 records'
  },
  {
    name: 'limit=10, offset=5',
    url: '/history?limit=10&offset=5',
    expected: { limit: 10, offset: 5 },
    description: 'Should return records 6-15'
  },
  {
    name: 'limit=100（最大値）',
    url: '/history?limit=100&offset=0',
    expected: { limit: 100, offset: 0 },
    description: 'Should return up to 100 records'
  },
  {
    name: 'limit=200（最大値超過）',
    url: '/history?limit=200&offset=0',
    expected: { limit: 100, offset: 0 },
    description: 'Should limit to max 100 records'
  },
  {
    name: 'limit=0（不正値）',
    url: '/history?limit=0&offset=0',
    expected: null,
    expectError: true,
    description: 'Should return 400 error for invalid limit'
  },
  {
    name: 'offset=-1（負の値）',
    url: '/history?limit=10&offset=-1',
    expected: null,
    expectError: true,
    description: 'Should return 400 error for negative offset'
  },
  {
    name: 'limit=abc（文字列）',
    url: '/history?limit=abc&offset=0',
    expected: { limit: 10, offset: 0 },
    description: 'Should fallback to default limit for non-numeric value'
  }
];

/**
 * 単一テストケースの実行
 */
async function runTestCase(testCase) {
  try {
    console.log(`🔍 テスト: ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    console.log(`   説明: ${testCase.description}`);

    const response = await axios.get(`${BASE_URL}${testCase.url}`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // レスポンス検証
    const data = response.data;
    
    if (testCase.expectError) {
      console.log(`   ❌ エラーが期待されましたが、成功レスポンスを受信: ${response.status}`);
      return false;
    }

    // 基本構造チェック
    const requiredFields = ['success', 'count', 'totalCount', 'offset', 'limit', 'hasMore', 'data', 'history', 'message'];
    const missingFields = requiredFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      console.log(`   ❌ 必須フィールドが不足: ${missingFields.join(', ')}`);
      return false;
    }

    // パラメータ検証
    if (testCase.expected) {
      const { limit: expectedLimit, offset: expectedOffset } = testCase.expected;
      if (data.limit === expectedLimit && data.offset === expectedOffset) {
        console.log(`   ✅ パラメータ検証 OK (limit: ${data.limit}, offset: ${data.offset})`);
      } else {
        console.log(`   ❌ パラメータ不一致: expected(${expectedLimit}, ${expectedOffset}), got(${data.limit}, ${data.offset})`);
        return false;
      }
    }

    // データ整合性チェック
    if (data.data.length !== data.count) {
      console.log(`   ❌ count不一致: data.length=${data.data.length}, count=${data.count}`);
      return false;
    }

    if (data.data.length !== data.history.length) {
      console.log(`   ❌ data/history配列長不一致: data=${data.data.length}, history=${data.history.length}`);
      return false;
    }

    // hasMore計算チェック
    const expectedHasMore = (data.offset + data.limit) < data.totalCount;
    if (data.hasMore !== expectedHasMore) {
      console.log(`   ❌ hasMore計算エラー: expected=${expectedHasMore}, got=${data.hasMore}`);
      return false;
    }

    // 追加情報表示
    console.log(`   ✅ レスポンス構造 OK`);
    console.log(`   📊 結果: ${data.count}件取得 / 全${data.totalCount}件 (hasMore: ${data.hasMore})`);
    
    if (data.currentStreak !== undefined && data.maxStreak !== undefined) {
      console.log(`   🔥 連続記録: 現在${data.currentStreak}日, 最高${data.maxStreak}日`);
    }

    return true;

  } catch (error) {
    if (testCase.expectError && error.response && error.response.status >= 400) {
      console.log(`   ✅ 期待されたエラー: HTTP ${error.response.status}`);
      if (error.response.data?.message) {
        console.log(`   📝 エラーメッセージ: ${error.response.data.message}`);
      }
      return true;
    } else if (error.response) {
      console.log(`   ❌ HTTP ${error.response.status}: ${error.response.data?.message || error.message}`);
      if (error.response.data) {
        console.log(`   📋 レスポンス詳細:`, JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`   ❌ 接続エラー: APIサーバーが起動していません`);
    } else {
      console.log(`   ❌ エラー: ${error.message}`);
    }
    return false;
  }
}

/**
 * 全テストの実行
 */
async function runAllTests() {
  console.log('🧪 Vercel API履歴ページング機能テスト開始\n');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const success = await runTestCase(testCase);
    
    if (success) {
      passedTests++;
    }
    
    console.log(''); // 空行
    
    // テスト間の間隔
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // テスト結果サマリー
  console.log('📋 テスト結果サマリー');
  console.log(`   合格: ${passedTests}/${totalTests} テスト`);
  console.log(`   成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('   🎉 全テスト合格！');
    console.log('   ✨ api/history.js のページング機能は正常に動作しています');
  } else {
    console.log('   ⚠️  一部テストが失敗しました');
    console.log('   🔧 api/history.js の実装を確認してください');
  }

  return passedTests === totalTests;
}

/**
 * ヘルスチェック
 */
async function healthCheck() {
  try {
    console.log('🏥 ヘルスチェック実行中...');
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/api/health`, {
      timeout: 5000
    });
    console.log('✅ APIサーバー接続確認 OK\n');
    return true;
  } catch (error) {
    console.log('❌ APIサーバーに接続できません');
    console.log('📋 確認事項:');
    console.log('   1. Vercelローカルサーバーが起動していますか？ (vercel dev)');
    console.log('   2. 正しいポート番号ですか？ (通常3000番)');
    console.log('   3. BASE_URLが正しく設定されていますか？');
    console.log(`   現在のBASE_URL: ${BASE_URL}\n`);
    return false;
  }
}

// メイン実行
if (require.main === module) {
  (async () => {
    const isHealthy = await healthCheck();
    
    if (isHealthy) {
      const success = await runAllTests();
      process.exit(success ? 0 : 1);
    } else {
      console.log('🚫 ヘルスチェックに失敗したため、テストを中止します');
      process.exit(1);
    }
  })().catch(error => {
    console.error('❌ テスト実行中に予期せぬエラーが発生しました:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests, runTestCase, healthCheck };