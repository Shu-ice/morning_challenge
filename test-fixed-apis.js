// 🔧 修正されたAPI テスト
const axios = require('axios');

const BASE_URL = 'https://morningchallenge-90zcj7e6l-shu-ices-projects.vercel.app';

async function testFixedAPIs() {
  console.log('🔧 修正されたAPI テスト開始...');
  
  let adminToken = null;
  
  try {
    // 1. ログイン
    console.log('1. ログインテスト...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    adminToken = loginResponse.data.token;
    console.log('✅ ログイン成功');
    
    // 2. ランキングAPIテスト
    console.log('\n2. ランキングAPIテスト...');
    try {
      const rankingResponse = await axios.get(`${BASE_URL}/api/rankings`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      console.log('✅ ランキング取得成功:', rankingResponse.status);
      console.log('📊 ランキング件数:', rankingResponse.data.count);
      
    } catch (error) {
      console.log('❌ ランキングエラー:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
    }

    // 3. 履歴APIテスト
    console.log('\n3. 履歴APIテスト...');
    try {
      const historyResponse = await axios.get(`${BASE_URL}/api/history`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      console.log('✅ 履歴取得成功:', historyResponse.status);
      console.log('📜 履歴件数:', historyResponse.data.count);
      
    } catch (error) {
      console.log('❌ 履歴エラー:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
    }

    // 4. 学年変更テスト（1-6年生）
    console.log('\n4. 学年変更テスト...');
    
    const testGrades = [1, 2, 3, 4, 5, 6];
    
    for (const grade of testGrades) {
      try {
        console.log(`\n🎓 学年${grade}年生へ変更中...`);
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
        
        console.log(`✅ 学年${grade}年生変更成功:`, profileResponse.status);
        
      } catch (error) {
        console.log(`❌ 学年${grade}年生変更エラー:`, {
          status: error.response?.status,
          message: error.response?.data?.message
        });
      }
    }

    // 5. 「その他」「ひみつ」テスト
    console.log('\n5. 特別学年テスト...');
    
    // その他（7）
    try {
      console.log('\n📚 「その他」へ変更中...');
      const otherResponse = await axios.put(`${BASE_URL}/api/users/profile`, {
        username: 'admin',
        grade: 7,
        avatar: `🎓`
      }, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ 「その他」変更成功:', otherResponse.status);
      
    } catch (error) {
      console.log('❌ 「その他」変更エラー:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
    }

    // ひみつ（999）
    try {
      console.log('\n🤫 「ひみつ」へ変更中...');
      const secretResponse = await axios.put(`${BASE_URL}/api/users/profile`, {
        username: 'admin',
        grade: 999,
        avatar: `🤫`
      }, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ 「ひみつ」変更成功:', secretResponse.status);
      
    } catch (error) {
      console.log('❌ 「ひみつ」変更エラー:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
    }

    console.log('\n🏁 修正されたAPI テスト完了');
    
  } catch (error) {
    console.log('❌ 全般エラー:', {
      status: error.response?.status,
      message: error.response?.data?.message,
      url: error.config?.url
    });
  }
}

testFixedAPIs().catch(err => {
  console.error('💥 テスト実行エラー:', err.message);
}); 