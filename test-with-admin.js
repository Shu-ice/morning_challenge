const axios = require('axios');

const API_BASE = 'http://localhost:5003/api';

async function testWithAdmin() {
  console.log('🔍 管理者ユーザーでのテスト開始...\n');

  try {
    // 1. 管理者でログイン
    console.log('1. 管理者ログインテスト...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    }, { withCredentials: true });
    
    console.log('✅ 管理者ログイン成功:', loginResponse.data.message);
    console.log('   管理者情報:', { 
      username: loginResponse.data.user?.username, 
      isAdmin: loginResponse.data.user?.isAdmin 
    });
    
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';

    // 2. 問題取得テスト（管理者は時間制限なし）
    console.log('\n2. 問題取得テスト（管理者権限）...');
    const problemsResponse = await axios.get(`${API_BASE}/problems`, {
      params: { 
        difficulty: 'beginner', 
        date: '2025-06-18'
      },
      headers: { Cookie: cookieString }
    });
    
    if (problemsResponse.data.success) {
      console.log('✅ 問題取得成功:', problemsResponse.data.problems?.length || 0, '問');
      
      // 3. 回答提出テスト
      console.log('\n3. 回答提出テスト...');
      const answers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const submitResponse = await axios.post(`${API_BASE}/problems/submit`, {
        difficulty: 'beginner',
        date: '2025-06-18',
        answers: answers,
        timeSpentMs: 25000,
        problemIds: Array(10).fill(0).map((_, i) => i + 1)
      }, {
        headers: { Cookie: cookieString }
      });
      
      if (submitResponse.data.success) {
        console.log('✅ 回答提出成功');
        console.log('   スコア:', submitResponse.data.score);
        console.log('   正解数:', submitResponse.data.correctAnswers);
      } else {
        console.log('❌ 回答提出失敗:', submitResponse.data.message);
      }

      // 4. 履歴取得テスト
      console.log('\n4. 履歴取得テスト...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const historyResponse = await axios.get(`${API_BASE}/history`, {
        headers: { Cookie: cookieString }
      });
      
      if (historyResponse.data.success) {
        console.log('✅ 履歴取得成功');
        console.log('   履歴件数:', historyResponse.data.count);
        if (historyResponse.data.data && historyResponse.data.data.length > 0) {
          historyResponse.data.data.slice(0, 2).forEach((item, index) => {
            console.log(`   履歴 ${index + 1}:`, {
              date: item.date,
              difficulty: item.difficulty,
              score: item.score,
              username: item.username,
              grade: item.grade
            });
          });
        }
      } else {
        console.log('❌ 履歴取得失敗:', historyResponse.data.message);
      }

      // 5. ランキング取得テスト
      console.log('\n5. ランキング取得テスト...');
      const rankingResponse = await axios.get(`${API_BASE}/rankings/daily`, {
        params: { 
          difficulty: 'beginner', 
          date: '2025-06-18',
          limit: 10 
        }
      });
      
      if (rankingResponse.data.success) {
        console.log('✅ ランキング取得成功');
        console.log('   ランキング件数:', rankingResponse.data.count);
        if (rankingResponse.data.data && rankingResponse.data.data.length > 0) {
          console.log('\n   ランキング詳細:');
          rankingResponse.data.data.slice(0, 5).forEach((user, index) => {
            console.log(`   ${user.rank}位: ${user.username} (学年: ${user.grade}) - ${user.score}点 (${user.correctAnswers}/${user.totalProblems})`);
          });
        }
      } else {
        console.log('❌ ランキング取得失敗:', rankingResponse.data.message);
      }

    } else {
      console.log('❌ 問題取得失敗:', problemsResponse.data.message);
    }

  } catch (error) {
    console.log('\n❌ テスト中にエラーが発生しました:');
    console.log('   エラー詳細:', error.response?.data || error.message);
  }

  console.log('\n🏁 管理者テスト完了');
}

testWithAdmin(); 