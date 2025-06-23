// 🔥 時間制限管理API - 管理者解除機能付き
console.log('🚀 Time Window API loaded');

// 時間制限設定
const timeWindow = {
  start: '06:30',
  end: '08:00',
  adminBypass: true, // 管理者は時間制限を無視
  timezone: 'Asia/Tokyo'
};

// 現在時刻が時間制限内かチェック
const isWithinTimeWindow = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute; // 分単位に変換
  
  const [startHour, startMinute] = timeWindow.start.split(':').map(Number);
  const [endHour, endMinute] = timeWindow.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  return currentTime >= startTime && currentTime <= endTime;
};

// 管理者チェック（JWTトークンから判定）
const isAdmin = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  
  // Cookieからもチェック
  if (req.cookies && req.cookies.jwt) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET || 'fallback-secret');
      return decoded.isAdmin === true;
    } catch (error) {
      console.log('JWT decode error:', error.message);
    }
  }
  
  // 簡易的なトークンチェック（本番環境では適切なJWT検証を実装）
  return authHeader.includes('admin-jwt-token') || authHeader.includes('admin@example.com');
};

module.exports = async function handler(req, res) {
  console.log('⏰ Time Window API called:', req.method, req.url);
  console.log('📝 Headers:', req.headers);
  
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // 時間制限状態の取得
      const within = isWithinTimeWindow();
      const userIsAdmin = isAdmin(req);
      const canAccess = within || (userIsAdmin && timeWindow.adminBypass);
      
      console.log('⏰ Time check:', {
        withinWindow: within,
        isAdmin: userIsAdmin,
        canAccess: canAccess,
        currentTime: new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' })
      });

      return res.status(200).json({
        success: true,
        timeWindow: {
          start: timeWindow.start,
          end: timeWindow.end,
          timezone: timeWindow.timezone,
          withinWindow: within,
          canAccess: canAccess,
          isAdmin: userIsAdmin,
          adminBypass: timeWindow.adminBypass
        },
        currentTime: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      // 時間制限設定の更新（管理者のみ）
      const userIsAdmin = isAdmin(req);
      
      if (!userIsAdmin) {
        console.log('❌ Unauthorized time window update attempt');
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const { start, end, adminBypass } = req.body;
      
      if (start) timeWindow.start = start;
      if (end) timeWindow.end = end;
      if (typeof adminBypass === 'boolean') timeWindow.adminBypass = adminBypass;

      console.log('✅ Time window updated:', timeWindow);
      
      return res.status(200).json({
        success: true,
        message: 'Time window updated successfully',
        timeWindow: timeWindow,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('💥 Time window API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 