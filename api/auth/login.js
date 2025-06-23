// Vercel Function: /api/auth/login
// 確実にログイン機能を提供

module.exports = async function handler(req, res) {
  console.log(`🔐 Login API: ${req.method} ${req.url}`);
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエスト処理
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS handled');
    return res.status(200).end();
  }

  // POSTリクエストのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    const { email, password } = req.body;
    console.log(`🚀 Login request for: ${email}`);

    // バリデーション
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // 管理者認証
    if (email === 'admin@example.com' && password === 'admin123') {
      console.log('✅ Admin authentication successful');
      
      const user = {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        isAdmin: true,
        grade: 6,
        avatar: '👑'
      };

      const token = `jwt-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: user,
        token: token,
        timestamp: new Date().toISOString()
      });
    }

    // 認証失敗
    console.log(`❌ Authentication failed for: ${email}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });

  } catch (error) {
    console.error('❌ Login API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}; 