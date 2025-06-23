const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// CORS設定
app.use(cors({
  origin: '*',
  credentials: true
}));

// JSON パーシング
app.use(express.json());

// ログイン API
app.post('/api/auth/login', (req, res) => {
  console.log('🔗 Login API called:', req.body);
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }
  
  if (email === 'admin@example.com' && password === 'admin123') {
    console.log('✅ Admin login successful');
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
      token: 'jwt-token-' + Date.now(),
      timestamp: new Date().toISOString()
    });
  }
  
  console.log('❌ Invalid credentials');
  return res.status(401).json({
    success: false,
    error: 'Invalid credentials'
  });
});

// 管理者ダッシュボード API
app.get('/api/admin-dashboard', (req, res) => {
  console.log('🔗 Admin dashboard API called');
  return res.status(200).json({
    success: true,
    data: {
      totalUsers: 42,
      activeUsers: 15,
      todayProblems: 10,
      systemStatus: 'healthy'
    }
  });
});

// 問題 API
app.get('/api/problems', (req, res) => {
  console.log('🔗 Problems API called:', req.query);
  return res.status(200).json({
    success: true,
    problems: [
      { id: 1, question: "5 + 3 = ?", answer: 8, difficulty: "easy" },
      { id: 2, question: "12 × 4 = ?", answer: 48, difficulty: "easy" }
    ]
  });
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  return res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
}); 