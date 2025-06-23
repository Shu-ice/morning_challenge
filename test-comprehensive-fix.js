const axios = require('axios');

const API_BASE = 'http://localhost:5003/api';

async function testAllFixes() {
  console.log('🔍 修正後の包括的テスト開始...\n');

  try {
    // 1. ログイン
    console.log('1. ログインテスト...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@example.com',
      password: 'test123'
    }, { withCredentials: true });
    
    console.log('✅ ログイン成功:', loginResponse.data.message);
    console.log('   ユーザー情報:', { 
      username: loginResponse.data.user?.username, 
      id: loginResponse.data.user?._id 
    });
    
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';

    // 2. 時間制限メッセージテスト（testユーザーでテスト）
    console.log('\n2. 時間制限メッセージテスト...');
    try {
      const problemsResponse = await axios.get(`${API_BASE}/problems`, {
        params: { difficulty: 'beginner', date: '2025-06-18' },
        headers: { Cookie: cookieString }
      });
      
      if (problemsResponse.data.success) {
        console.log('⚠️ 時間制限が無視されました（testユーザーの特別扱いが適用されています）');
        console.log('   問題数:', problemsResponse.data.problems?.length || 0);
      }
    } catch (timeError) {
      if (timeError.response?.status === 403) {
        console.log('✅ 時間制限メッセージ確認成功:');
        console.log('   メッセージ:', timeError.response.data.message);
        console.log('   現在時刻:', timeError.response.data.currentTime);
        console.log('   許可時間:', timeError.response.data.allowedTime);
      } else {
        console.log('❌ 時間制限テストでエラー:', timeError.message);
      }
    }

    // 3. 環境変数でスキップして実際のテストを続行
    console.log('\n3. 問題取得テスト（環境変数スキップ）...');
    // サーバーのDISABLE_TIME_CHECKを一時的にtrueに変更して継続
    const problemsResponse = await axios.get(`${API_BASE}/problems`, {
      params: { 
        difficulty: 'beginner', 
        date: '2025-06-18',
        skipTimeCheck: 'true' // クエリパラメータでスキップ
      },
      headers: { Cookie: cookieString }
    });
    
    if (problemsResponse.data.success) {
      console.log('✅ 問題取得成功:', problemsResponse.data.problems?.length || 0, '問');
      
      // 4. 回答提出テスト
      console.log('\n4. 回答提出テスト...');
      const answers = Array(10).fill(0).map((_, i) => i % 2); // 0と1を交互に
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

      // 5. 履歴取得テスト
      console.log('\n5. 履歴取得テスト...');
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
            username: latest.username
          });
        }
      } else {
        console.log('❌ 履歴取得失敗:', historyResponse.data.message);
      }

      // 6. ランキング取得テスト
      console.log('\n6. ランキング取得テスト...');
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

  console.log('\n🏁 包括的テスト完了');
}

testAllFixes(); 