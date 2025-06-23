// 🧪 問題生成機能クイックテスト
console.log('🧪 Testing problems functionality...');

const BASE_URL = 'https://morningchallenge-k1ncllwn0-shu-ices-projects.vercel.app';

// Node.js 18+ の fetch を使用
async function testProblems() {
  try {
    console.log('1. 問題取得テスト（時間制限なし）...');
    
    const response = await fetch(`${BASE_URL}/api/problems?difficulty=beginner`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer admin-test-token',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('✅ Response status:', response.status);
    console.log('✅ Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.problems && data.problems.length > 0) {
      console.log('🎯 問題生成成功！');
      console.log(`📝 生成された問題数: ${data.problems.length}`);
      console.log('📚 サンプル問題:', data.problems.slice(0, 3));
    } else {
      console.log('❌ 問題生成に失敗:', data.message || data.error);
    }
    
  } catch (error) {
    console.error('💥 テストエラー:', error.message);
  }
}

testProblems(); 