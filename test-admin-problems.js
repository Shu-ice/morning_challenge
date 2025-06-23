// 🧪 管理者権限での問題生成・取得テスト
console.log('🧪 Testing admin problems functionality...');

const BASE_URL = 'https://morningchallenge-e5z0usopw-shu-ices-projects.vercel.app';

async function testAdminProblems() {
  try {
    console.log('1. 管理者ログインテスト...');
    
    // 管理者ログイン
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('✅ Login response:', loginData);
    
    if (!loginData.success) {
      throw new Error('ログインに失敗しました');
    }
    
    const token = loginData.token;
    console.log('🔑 Token received:', token.substring(0, 20) + '...');
    
    console.log('2. 管理者権限での問題取得テスト...');
    
    // 問題取得（時間制限に関係なく）
    const problemsResponse = await fetch(`${BASE_URL}/api/problems?grade=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const problemsData = await problemsResponse.json();
    console.log('✅ Problems response:', problemsData);
    
    if (problemsData.success && problemsData.problems && problemsData.problems.length > 0) {
      console.log(`🎯 問題生成成功! ${problemsData.problems.length}問取得`);
      console.log('📝 サンプル問題:', problemsData.problems.slice(0, 3));
      
      if (problemsData.timeWindow && problemsData.timeWindow.adminBypass) {
        console.log('✅ 管理者権限が正しく認識されています！');
      }
    } else {
      console.log('❌ 問題の生成に失敗しました:', problemsData);
    }
    
    console.log('3. 時間制限情報の確認...');
    
    // 時間制限状態確認
    const timeResponse = await fetch(`${BASE_URL}/api/time-window`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const timeData = await timeResponse.json();
    console.log('⏰ Time window status:', timeData);
    
    console.log('🎉 管理者問題機能テスト完了！');
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
    console.error('💥 Error details:', error.message);
  }
}

testAdminProblems();
