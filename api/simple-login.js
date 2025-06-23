// シンプルなログインエンドポイント - 依存関係最小限
module.exports = async function handler(req, res) {
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    // ハードコードされた管理者認証（テスト用）
    if (email === 'admin@example.com' && password === 'admin123') {
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          username: 'admin',
          isAdmin: true,
          grade: 6,
          avatar: '👑'
        },
        token: 'test-jwt-token-' + Date.now(),
        timestamp: new Date().toISOString()
      });
    }

    // 認証失敗
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}