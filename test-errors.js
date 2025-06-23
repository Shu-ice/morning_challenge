// 🐛 エラー調査テスト
const axios = require('axios');

const BASE_URL = 'https://morningchallenge-s107pscwz-shu-ices-projects.vercel.app';

async function testErrors() {
  console.log('🐛 エラー調査テスト開始...');
  
  let adminToken = null;
  
  try {
    // 1. ログイン
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    adminToken = loginResponse.data.token;
    console.log('✅ ログイン成功');
    
    // 2. 各学年への変更テスト
    console.log('\n📚 2. 各学年への変更テスト...');
    
    const testGrades = [1, 2, 3, 4, 5, 6, 7];
    
    for (const grade of testGrades) {
      try {
        console.log(`\n🎓 学年${grade}へ変更中...`);
        const profileResponse = await axios.put(`${BASE_URL}/api/users/profile`, {
          username: 'admin',
          grade: grade,
          avatar: `📚`
        }, {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`✅ 学年${grade}変更成功:`, profileResponse.status);
        
      } catch (error) {
        console.log(`❌ 学年${grade}変更エラー:`, {
          status: error.response?.status,
          message: error.response?.data?.message,
          error: error.response?.data?.error
        });
      }
    }

    // 3. ランキングAPIテスト
    console.log('\n🏆 3. ランキングAPIテスト...');
    try {
      const rankingResponse = await axios.get(`${BASE_URL}/api/rankings`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      console.log('✅ ランキング取得成功:', rankingResponse.status);
      console.log('📊 ランキングデータ:', rankingResponse.data);
      
    } catch (error) {
      console.log('❌ ランキング取得エラー:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        url: error.config?.url
      });
    }

    // 4. 履歴APIテスト
    console.log('\n📜 4. 履歴APIテスト...');
    try {
      const historyResponse = await axios.get(`${BASE_URL}/api/history`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      console.log('✅ 履歴取得成功:', historyResponse.status);
      console.log('📊 履歴データ:', historyResponse.data);
      
    } catch (error) {
      console.log('❌ 履歴取得エラー:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        url: error.config?.url
      });
    }

    // 5. 現在のAPI一覧確認
    console.log('\n📋 5. 残存APIファイル確認...');
    console.log('現在のAPIエンドポイント:');
    console.log('- /api/problems (問題生成)');
    console.log('- /api/auth/login (ログイン)');
    console.log('- /api/auth/update-password (パスワード変更)');
    console.log('- /api/users/profile (プロフィール)');
    console.log('- /api/admin-dashboard (管理者ダッシュボード)');
    console.log('- /api/admin-stats (統計)');
    console.log('- /api/time-window (時間設定)');
    
  } catch (error) {
    console.log('❌ 全般エラー:', {
      status: error.response?.status,
      message: error.response?.data?.message,
      url: error.config?.url
    });
  }
}

testErrors().then(() => {
  console.log('\n🏁 エラー調査テスト完了');
}).catch(err => {
  console.error('💥 テスト実行エラー:', err.message);
}); 