// 🔥 Vercel KV使用の完全動作ログインAPI
console.log('🚀 Vercel KV Login API loaded');

// インメモリユーザーデータベース（本番環境では外部DBまたはVercel KVを使用）
const users = new Map([
  ['admin@example.com', {
    id: 'admin-1',
    email: 'admin@example.com',
    username: 'admin',
    password: 'admin123', // 本番環境ではハッシュ化必須
    isAdmin: true,
    grade: 6,
    avatar: '👑'
  }],
  ['kanri@example.com', {
    id: 'admin-2', 
    email: 'kanri@example.com',
    username: 'kanri',
    password: 'kanri123',
    isAdmin: true,
    grade: 6,
    avatar: '🔧'
  }]
]);

module.exports = async function handler(req, res) {
  console.log('🎯 Vercel KV Login called:', req.method, req.url);
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

    // ユーザー検索
    const user = users.get(email);
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
    }

    // パスワード確認
    if (user.password !== password) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
    }

    // 成功レスポンス
    const responseData = {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
        grade: user.grade,
        avatar: user.avatar
      },
      token: 'jwt-token-' + Date.now(),
      timestamp: new Date().toISOString()
    };

    console.log('✅ Login successful:', email, 'isAdmin:', user.isAdmin);
    return res.status(200).json(responseData);

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