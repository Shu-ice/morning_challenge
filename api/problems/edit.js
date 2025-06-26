// 📑 /api/problems/edit - Get or update a DailyProblemSet
// 🚀 最適化版 - グローバルキャッシュと一元化モデルを使用

const { connectMongoose } = require('../_lib/database');
const { DailyProblemSet } = require('../_lib/models');

module.exports = async function handler(req, res) {
  // --- CORS ヘッダー ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 🚀 最適化されたDB接続
    await connectMongoose();

    if (req.method === 'GET') {
      const { date, difficulty } = req.query;
      if (!date || !difficulty) {
        return res.status(400).json({ success: false, error: 'date and difficulty are required' });
      }

      const doc = await DailyProblemSet.findOne({ date, difficulty });
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Not Found', message: '問題セットが見つかりません' });
      }

      const mapped = doc.problems.map(p => ({
        ...p,
        correctAnswer: p.correctAnswer !== undefined ? p.correctAnswer : p.answer
      }));
      return res.status(200).json({ success: true, data: mapped, date: doc.date, difficulty: doc.difficulty, isEdited: doc.isEdited });
    }

    if (req.method === 'POST') {
      const { date, difficulty, problems } = req.body || {};
      if (!date || !difficulty || !Array.isArray(problems)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      // ensure each problem has correctAnswer
      const processed = problems.map(p => ({
        ...p,
        correctAnswer: p.correctAnswer !== undefined ? p.correctAnswer : p.answer
      }));

      const updated = await DailyProblemSet.findOneAndUpdate(
        { date, difficulty },
        { problems: processed, isEdited: true },
        { upsert: true, new: true }
      );

      return res.status(200).json({ success: true, message: 'Saved', data: updated.problems, date: updated.date, difficulty: updated.difficulty });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[edit] Error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}; 