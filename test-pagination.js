#!/usr/bin/env node

/**
 * 履歴API ページング機能テストスクリプト
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5003/api';
const TEST_TOKEN = 'test-token'; // モック環境用

// テスト用データ
const testCases = [
  {
    name: 'デフォルト（パラメータなし）',
    url: '/history',
    expected: { limit: 10, offset: 0 }
  },
  {
    name: 'limit=5, offset=0',
    url: '/history?limit=5&offset=0',
    expected: { limit: 5, offset: 0 }
  },
  {
    name: 'limit=10, offset=20',
    url: '/history?limit=10&offset=20',
    expected: { limit: 10, offset: 20 }
  },
  {
    name: 'limit=100（最大値）',
    url: '/history?limit=100&offset=0',
    expected: { limit: 100, offset: 0 }
  },
  {
    name: 'limit=200（最大値超過）',
    url: '/history?limit=200&offset=0',
    expected: { limit: 100, offset: 0 } // 100に自動補正
  },
  {
    name: 'limit=-1（負の値）',
    url: '/history?limit=-1&offset=0',
    expected: { limit: 10, offset: 0 } // デフォルトに補正
  },
  {
    name: 'offset=-5（負の値）',
    url: '/history?limit=10&offset=-5',
    expected: { limit: 10, offset: 0 } // 0に補正
  },
  {
    name: 'limit=abc（文字列）',
    url: '/history?limit=abc&offset=0',
    expected: { limit: 10, offset: 0 } // デフォルトに補正
  }
];

async function testPagination() {
  console.log('🧪 履歴API ページング機能テスト開始\n');

  // サーバーの健康状態チェック
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ サーバー接続確認 OK\n');
  } catch (error) {
    console.error('❌ サーバーに接続できません:', error.message);
    console.log('サーバーを起動してください: npm run dev:backend\n');
    return;
  }

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      console.log(`🔍 テスト: ${testCase.name}`);
      console.log(`   URL: ${testCase.url}`);

      const response = await axios.get(`${BASE_URL}${testCase.url}`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      // レスポンス検証
      const data = response.data;
      
      // 基本構造チェック
      const requiredFields = ['success', 'count', 'total', 'totalCount', 'offset', 'limit', 'hasMore', 'data', 'message'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      if (missingFields.length > 0) {
        console.log(`   ❌ 必須フィールドが不足: ${missingFields.join(', ')}`);
        continue;
      }

      // パラメータ検証
      const { limit: expectedLimit, offset: expectedOffset } = testCase.expected;
      if (data.limit === expectedLimit && data.offset === expectedOffset) {
        console.log(`   ✅ パラメータ検証 OK (limit: ${data.limit}, offset: ${data.offset})`);
        
        // 追加検証
        const hasMoreCheck = (data.offset + data.limit) < data.totalCount;
        if (data.hasMore === hasMoreCheck) {
          console.log(`   ✅ hasMore計算 OK (${data.hasMore})`);
        } else {
          console.log(`   ⚠️  hasMore計算に問題: expected ${hasMoreCheck}, got ${data.hasMore}`);
        }
        
        console.log(`   📊 結果: ${data.count}件取得 / 全${data.totalCount}件`);
        passedTests++;
      } else {
        console.log(`   ❌ パラメータ不一致: expected(${expectedLimit}, ${expectedOffset}), got(${data.limit}, ${data.offset})`);
      }

    } catch (error) {
      if (error.response) {
        console.log(`   ❌ HTTP ${error.response.status}: ${error.response.data?.message || error.message}`);
      } else {
        console.log(`   ❌ エラー: ${error.message}`);
      }
    }
    
    console.log(''); // 空行
  }

  // テスト結果サマリー
  console.log('📋 テスト結果サマリー');
  console.log(`   合格: ${passedTests}/${totalTests} テスト`);
  console.log(`   成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('   🎉 全テスト合格！');
  } else {
    console.log('   ⚠️  一部テストが失敗しました');
  }
}

// メイン実行
if (require.main === module) {
  testPagination().catch(console.error);
}

module.exports = { testPagination };