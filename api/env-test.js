// 環境変数確認エンドポイント - Vercel Function形式
module.exports = function handler(req, res) {
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      MONGODB_URI: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set',
      JWT_SECRET: process.env.JWT_SECRET ? 'Set (hidden)' : 'Not set',
      VERCEL: process.env.VERCEL || 'false',
      VERCEL_URL: process.env.VERCEL_URL || 'Not set'
    };

    res.status(200).json({
      success: true,
      environment: envInfo,
      message: '環境変数確認完了',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}