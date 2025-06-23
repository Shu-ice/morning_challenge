// Vercel Function: /api/auth
// Handles /api/auth/login requests

module.exports = async function handler(req, res) {
  console.log(`🔗 Auth API: ${req.method} ${req.url}`);
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエスト処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTリクエストはログイン処理
  if (req.method === 'POST') {
    try {
      const { email, password } = req.body;

      console.log(`🔐 Login attempt: ${email}`);

      // 基本的なバリデーション
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // 管理者認証
      if (email === 'admin@example.com' && password === 'admin123') {
        console.log('✅ Admin login successful');
        
        const user = {
          id: 'admin-1',
          email: 'admin@example.com',
          username: 'admin',
          isAdmin: true,
          grade: 6,
          avatar: '👑'
        };

        return res.status(200).json({
          success: true,
          message: 'Login successful',
          user: user,
          token: `jwt-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString()
        });
      }

      // 認証失敗
      console.log(`❌ Invalid credentials: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // GETリクエスト - エンドポイント情報
  return res.status(200).json({
    success: true,
    message: 'Auth API endpoint',
    availableEndpoints: ['/api/auth/login (POST)'],
    timestamp: new Date().toISOString()
  });
}; 