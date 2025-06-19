const axios = require('axios');

const API_BASE = 'http://localhost:5003/api';

async function testFunctionsOnly() {
  console.log('🔍 機能テスト（時間制限スキップ）開始...\n');

  try {
    // 1. ログイン
    console.log('1. ログインテスト...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@example.com',
      password: 'test123'
    }, { withCredentials: true });
    
    console.log('✅ ログイン成功:', loginResponse.data.message);
    
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';

    // 2. 管理者権限でスキップして問題取得
    console.log('\n2. 問題取得テスト（管理者権限でスキップ）...');
    const problemsResponse = await axios.get(`${API_BASE}/problems`, {
      params: { 
        difficulty: 'beginner', 
        date: '2025-06-18',
        skipTimeCheck: 'true'
      },
      headers: { Cookie: cookieString }
    });
    
    if (problemsResponse.data.success) {
      console.log('✅ 問題取得成功:', problemsResponse.data.problems?.length || 0, '問');
      
      // 3. 回答提出テスト
      console.log('\n3. 回答提出テスト...');
      const answers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 適当な回答
      const submitResponse = await axios.post(`${API_BASE}/problems/submit`, {
        difficulty: 'beginner',
        date: '2025-06-18',
        answers: answers,
        timeSpentMs: 30000,
        problemIds: Array(10).fill(0).map((_, i) => i + 1)
      }, {
        headers: { Cookie: cookieString }
      });
      
      if (submitResponse.data.success) {
        console.log('✅ 回答提出成功');
        console.log('   スコア:', submitResponse.data.score);
        console.log('   正解数:', submitResponse.data.correctAnswers);
        console.log('   結果ID:', submitResponse.data.resultId);
      } else {
        console.log('❌ 回答提出失敗:', submitResponse.data.message);
      }

      // 少し待ってから履歴取得
      console.log('\n4. 履歴取得テスト（1秒待機後）...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const historyResponse = await axios.get(`${API_BASE}/history`, {
        headers: { Cookie: cookieString }
      });
      
      if (historyResponse.data.success) {
        console.log('✅ 履歴取得成功');
        console.log('   履歴件数:', historyResponse.data.count);
        if (historyResponse.data.data && historyResponse.data.data.length > 0) {
          const latest = historyResponse.data.data[0];
          console.log('   最新の履歴:', {
            date: latest.date,
            difficulty: latest.difficulty,
            score: latest.score,
            correctAnswers: latest.correctAnswers,
            username: latest.username,
            grade: latest.grade
          });
        } else {
          console.log('   履歴データなし');
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
          const topUser = rankingResponse.data.data[0];
          console.log('   1位の情報:', {
            username: topUser.username,
            grade: topUser.grade,
            score: topUser.score,
            correctAnswers: topUser.correctAnswers,
            totalProblems: topUser.totalProblems
          });
          
          // 複数のランキングユーザーの確認
          console.log('\n   全ランキングユーザー:');
          rankingResponse.data.data.slice(0, 3).forEach((user, index) => {
            console.log(`   ${index + 1}位: ${user.username} (${user.grade}年生) - ${user.score}点`);
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
    if (error.response?.status === 403) {
      console.log('   時間制限エラーの可能性があります');
    }
  }

  console.log('\n🏁 機能テスト完了');
}

testFunctionsOnly(); 