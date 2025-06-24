// 📤 /api/problems/submit - Answer submission endpoint
const jwt = require('jsonwebtoken');
const problemsModule = require('path').join('..', 'problems');
const problemsHandler = require(problemsModule);
const generateProblemSet = problemsHandler.generateProblemSet;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// 時間制限チェック（6:30-8:00）
const isWithinTimeWindow = () => {
  const now = new Date();
  const t = now.getHours() + now.getMinutes() / 60;
  return t >= 6.5 && t <= 8.0;
};

// JWT から admin 判定
function isAdmin(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.isAdmin === true;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { answers, timeToComplete, difficulty = 'beginner' } = req.body || {};
    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, error: 'Answers array required' });
    }

    const admin = isAdmin(req);
    if (!admin && !isWithinTimeWindow() && process.env.DISABLE_TIME_CHECK !== 'true') {
      return res.status(403).json({ success: false, error: 'Time restricted' });
    }

    const correctProblems = generateProblemSet(difficulty);
    let correctCount = 0;
    answers.forEach((ans, idx) => {
      if (correctProblems[idx] && Number(ans) === correctProblems[idx].answer) correctCount++;
    });
    const score = Math.round((correctCount / correctProblems.length) * 100);

    return res.status(200).json({
      success: true,
      result: {
        correctAnswers: correctCount,
        totalProblems: correctProblems.length,
        score,
        timeSpent: timeToComplete,
        difficulty
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[submit] Error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}; 