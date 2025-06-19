const axios = require('axios');

const API_BASE = 'http://localhost:5003/api';

async function testTimeCheckAndHistory() {
  console.log('🔍 時間制限と履歴機能のテスト開始...\n');

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
    
    // クッキーを取得
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';
    console.log('   クッキー:', cookieString ? 'あり' : 'なし');
    
    // 2. 問題取得テスト（時間制限チェック）
    console.log('\n2. 問題取得テスト（時間制限チェック）...');
    let problems = [];
    try {
      const problemsResponse = await axios.get(`${API_BASE}/problems`, {
        params: { difficulty: 'beginner', date: '2025-06-18' },
        headers: { Cookie: cookieString }
      });
      console.log('✅ 問題取得成功:', problemsResponse.data.problems?.length || 0, '問');
      console.log('   - DISABLE_TIME_CHECK が正常に動作しています');
      problems = problemsResponse.data.problems || [];
      
      if (problems.length > 0) {
        console.log('   - 最初の問題ID:', problems[0].id);
        console.log('   - 最初の問題:', problems[0].question?.substring(0, 30) + '...');
      }
    } catch (problemError) {
      if (problemError.response?.status === 403 && problemError.response?.data?.isTimeRestricted) {
        console.log('❌ 時間制限エラー:', problemError.response.data.message);
        console.log('   - DISABLE_TIME_CHECK が正常に動作していません');
        return; // 問題取得できなければ以降のテストは意味がない
      } else {
        console.log('❌ その他のエラー:', problemError.message);
        console.log('   レスポンス:', problemError.response?.data);
        return;
      }
    }

    // 3. 回答提出テスト
    console.log('\n3. 回答提出テスト...');
    if (problems.length === 0) {
      console.log('❌ 問題がないため回答提出をスキップします');
      return;
    }
    
    // 実際の問題IDを使用
    const problemIds = problems.map(p => p.id);
    const answers = problems.map((_, index) => (index + 1).toString()); // 1, 2, 3, ...
    
    console.log('   送信データ:', {
      difficulty: 'beginner',
      date: '2025-06-18',
      problemIds: problemIds.slice(0, 3), // 最初の3つのIDのみ表示
      answersCount: answers.length
    });
    
    try {
      const submitResponse = await axios.post(`${API_BASE}/problems/submit`, {
        difficulty: 'beginner',
        date: '2025-06-18',
        answers: answers,
        timeSpentMs: 60000,
        problemIds: problemIds
      }, {
        headers: { 
          Cookie: cookieString,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ 回答提出成功:', submitResponse.data.message);
      console.log('   - スコア:', submitResponse.data.results?.score || 'N/A');
      console.log('   - 正解数:', submitResponse.data.results?.correctAnswers || 'N/A');
      console.log('   - 全問題数:', submitResponse.data.results?.totalProblems || 'N/A');
    } catch (submitError) {
      console.log('❌ 回答提出エラー:', submitError.response?.data?.message || submitError.message);
      console.log('   ステータス:', submitError.response?.status);
      console.log('   詳細:', submitError.response?.data);
    }

    // 4. 履歴取得テスト
    console.log('\n4. 履歴取得テスト...');
    try {
      const historyResponse = await axios.get(`${API_BASE}/history`, {
        headers: { Cookie: cookieString }
      });
      console.log('✅ 履歴取得成功:', historyResponse.data.count || 0, '件');
      if (historyResponse.data.data && historyResponse.data.data.length > 0) {
        const latest = historyResponse.data.data[0];
        console.log('   - 最新の履歴:', {
          _id: latest._id,
          date: latest.date,
          difficulty: latest.difficulty,
          score: latest.score,
          correctAnswers: latest.correctAnswers,
          totalProblems: latest.totalProblems
        });
      } else {
        console.log('   - 履歴データがありません');
      }
    } catch (historyError) {
      console.log('❌ 履歴取得エラー:', historyError.response?.data?.message || historyError.message);
      console.log('   ステータス:', historyError.response?.status);
      console.log('   詳細:', historyError.response?.data);
    }

  } catch (error) {
    console.error('❌ テスト全体でエラーが発生:', error.message);
    if (error.response) {
      console.error('   レスポンス:', error.response.data);
    }
  }
}

// テスト実行
testTimeCheckAndHistory(); 