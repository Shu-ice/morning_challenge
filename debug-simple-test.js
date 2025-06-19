/**
 * シンプルなログイン・プロフィール取得テスト
 */

console.log('🔍 シンプルデバッグテスト開始...\n');

try {
  // 1. ログインテスト
  console.log('=== ログインテスト ===');
  const loginResponse = await fetch('http://localhost:5003/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'kanri@example.com',
      password: 'kanri123'
    })
  });

  console.log('ログインレスポンススタータス:', loginResponse.status);
  console.log('ログインレスポンスヘッダー:', Object.fromEntries(loginResponse.headers.entries()));

  const loginText = await loginResponse.text();
  console.log('ログインレスポンス（生）:', loginText);

  let loginData;
  try {
    loginData = JSON.parse(loginText);
    console.log('ログインデータパース成功:', loginData);
  } catch (parseError) {
    console.error('❌ ログインデータのJSONパースエラー:', parseError);
    process.exit(1);
  }

  if (!loginData.success) {
    console.error('❌ ログイン失敗:', loginData.message);
    process.exit(1);
  }

  const token = loginData.token;
  const cookies = loginResponse.headers.get('set-cookie');
  console.log('取得したトークン:', token ? 'あり' : 'なし');
  console.log('取得したクッキー:', cookies ? 'あり' : 'なし');

  // 2. プロフィール取得テスト
  console.log('\n=== プロフィール取得テスト ===');
  const profileResponse = await fetch('http://localhost:5003/api/users/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': cookies || ''
    }
  });

  console.log('プロフィールレスポンススタータス:', profileResponse.status);
  console.log('プロフィールレスポンスヘッダー:', Object.fromEntries(profileResponse.headers.entries()));

  const profileText = await profileResponse.text();
  console.log('プロフィールレスポンス（生）:', profileText);

  let profileData;
  try {
    profileData = JSON.parse(profileText);
    console.log('プロフィールデータパース成功:', profileData);
  } catch (parseError) {
    console.error('❌ プロフィールデータのJSONパースエラー:', parseError);
    process.exit(1);
  }

  console.log('\n✅ デバッグテスト完了');

} catch (error) {
  console.error('❌ テスト中にエラー:', error);
} 