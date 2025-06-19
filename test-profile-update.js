#!/usr/bin/env node

/**
 * 🔥 緊急修正後のプロフィール更新テストスクリプト
 * モック環境でのプロフィール更新が完全に機能するかをテスト
 */

async function runComprehensiveTest() {
  console.log('🚀 緊急修正後のプロフィール更新テストを開始します...');
  console.log('📡 サーバーが http://localhost:5003 で起動していることを確認してください\n');

  try {
    // 1. testユーザーでログイン
    console.log('=== 1. testユーザーでログイン ===');
    const loginResponse = await fetch('http://localhost:5003/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('ログイン結果:', {
      success: loginData.success,
      username: loginData.user?.username,
      currentGrade: loginData.user?.grade,
      currentAvatar: loginData.user?.avatar,
      token: loginData.token ? '✅' : '❌'
    });

    if (!loginData.success) {
      console.error('❌ ログイン失敗');
      return false;
    }

    const token = loginData.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. 現在のプロフィール情報取得
    console.log('\n=== 2. 現在のプロフィール情報取得 ===');
    const profileResponse = await fetch('http://localhost:5003/api/users/profile', {
      headers: authHeaders
    });

    const profileData = await profileResponse.json();
    console.log('現在のプロフィール:', {
      username: profileData.user?.username,
      email: profileData.user?.email,
      grade: profileData.user?.grade,
      avatar: profileData.user?.avatar
    });

    // 3. 学年更新（3年生→8年生「ひみつ」）
    console.log('\n=== 3. 🔥 緊急テスト: 学年更新処理（3年生→8年生「ひみつ」） ===');
    const updateResponse = await fetch('http://localhost:5003/api/users/profile', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        grade: 8,  // ひみつ
        avatar: '🎭'  // 新しいアバター
      })
    });

    const updateData = await updateResponse.json();
    console.log('🔥 更新レスポンス:', {
      success: updateData.success,
      newGrade: updateData.user?.grade,
      newAvatar: updateData.user?.avatar,
      message: updateData.message,
      token: updateData.token ? '✅' : '❌'
    });

    if (!updateData.success || updateData.user?.grade !== 8) {
      console.error('❌ プロフィール更新失敗');
      return false;
    }

    // 4. 更新後のプロフィール確認（即座に）
    console.log('\n=== 4. 🔥 更新後のプロフィール確認（即座に） ===');
    const verifyResponse = await fetch('http://localhost:5003/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${updateData.token || token}`,
        'Content-Type': 'application/json'
      }
    });

    const verifyData = await verifyResponse.json();
    console.log('🔥 更新後のプロフィール:', {
      username: verifyData.user?.username,
      email: verifyData.user?.email,
      grade: verifyData.user?.grade,
      avatar: verifyData.user?.avatar
    });

    if (verifyData.user?.grade !== 8) {
      console.error('❌ プロフィール更新が永続化されていません');
      return false;
    }

    // 5. ランキングでの表示確認
    console.log('\n=== 5. 🔥 ランキングでの学年表示確認 ===');
    const rankingResponse = await fetch('http://localhost:5003/api/rankings/daily', {
      headers: authHeaders
    });

    const rankingData = await rankingResponse.json();
    console.log('ランキング結果:', {
      success: rankingData.success,
      count: rankingData.count || 0
    });

    // testユーザーがランキングに含まれているかチェック
    const testUserInRanking = rankingData.data?.find(item => 
      item.username === 'test' || item.userId === '3'
    );

    if (testUserInRanking) {
      console.log('🔥 ランキング内のtestユーザー:', {
        username: testUserInRanking.username,
        grade: testUserInRanking.grade,
        avatar: testUserInRanking.avatar
      });
      
      if (testUserInRanking.grade === 8) {
        console.log('🎉 ランキングでも正しい学年(8=ひみつ)が表示されています！');
      } else {
        console.log('⚠️ ランキングで学年が正しく表示されていません');
      }
    } else {
      console.log('📝 testユーザーはランキングに表示されていません（結果レコードがない場合）');
    }

    // 6. 再ログインして持続性確認
    console.log('\n=== 6. 🔥 再ログインして変更の持続性確認 ===');
    const reloginResponse = await fetch('http://localhost:5003/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123'
      })
    });

    const reloginData = await reloginResponse.json();
    console.log('🔥 再ログイン結果:', {
      success: reloginData.success,
      username: reloginData.user?.username,
      email: reloginData.user?.email,
      grade: reloginData.user?.grade,
      avatar: reloginData.user?.avatar
    });

    if (reloginData.user?.grade === 8) {
      console.log('🎉 再ログイン後も学年が正しく保持されています！');
    } else {
      console.error('❌ 再ログイン後に学年が元に戻ってしまいました');
      return false;
    }

    console.log('\n✅ 🎉 全てのテストが成功しました！');
    console.log('📊 期待される結果:');
    console.log('  - プロフィールAPI: grade=8 (ひみつ)');
    console.log('  - ランキングAPI: grade=8 (ひみつ)'); 
    console.log('  - フロントエンド: 「ひみつ」と表示される');
    
    return true;

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    return false;
  }
}

// Node.jsで直接実行される場合
if (require.main === module) {
  // 3秒後にテスト開始
  setTimeout(async () => {
    const success = await runComprehensiveTest();
    if (success) {
      console.log('\n🎉 緊急修正が成功しました！');
      process.exit(0);
    } else {
      console.log('\n❌ 緊急修正が失敗しました');
      process.exit(1);
    }
  }, 3000);
}

module.exports = { runComprehensiveTest }; 