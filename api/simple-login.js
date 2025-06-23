// 🔥 確実に動作するログインエンドポイント - MongoDB不要
module.exports = async function handler(req, res) {
  console.log('🚀 Simple login called:', req.method, req.url);
  console.log('📝 Request body:', req.body);
  
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    console.log('🔍 Login attempt:', { email, password: password ? '***' : 'missing' });

    if (!email || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        timestamp: new Date().toISOString()
      });
    }

    // 🏆 管理者アカウント認証（複数対応）
    const adminAccounts = [
      { email: 'admin@example.com', password: 'admin123', username: 'admin', avatar: '👑' },
      { email: 'kanri@example.com', password: 'kanri123', username: 'kanri', avatar: '🔧' }
    ];

    const admin = adminAccounts.find(acc => 
      acc.email === email && acc.password === password
    );

    if (admin) {
      console.log('✅ Admin login successful:', admin.email);
      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        user: {
          id: 'admin-' + Date.now(),
          email: admin.email,
          username: admin.username,
          isAdmin: true,
          grade: 6,
          avatar: admin.avatar
        },
        token: 'admin-jwt-token-' + Date.now(),
        timestamp: new Date().toISOString()
      });
    }

    // 👥 一般ユーザー認証（デモ用）
    if (email.includes('@') && password.length >= 4) {
      console.log('✅ User login successful:', email);
      return res.status(200).json({
        success: true,
        message: 'User login successful',
        user: {
          id: 'user-' + Date.now(),
          email: email,
          username: email.split('@')[0],
          isAdmin: false,
          grade: Math.floor(Math.random() * 6) + 1,
          avatar: '🧮'
        },
        token: 'user-jwt-token-' + Date.now(),
        timestamp: new Date().toISOString()
      });
    }

    // ❌ 認証失敗
    console.log('❌ Authentication failed');
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}