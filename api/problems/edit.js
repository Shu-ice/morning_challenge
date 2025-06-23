// 📑 /api/problems/edit - Get or update a DailyProblemSet
const mongoose = require('mongoose');

// --- Mongoose model 定義（重複読み込み防止）
const dailyProblemSetSchema = new mongoose.Schema({
  date: { type: String, required: true },
  difficulty: { type: String, required: true },
  problems: { type: Array, required: true },
  isEdited: { type: Boolean, default: false }
}, { timestamps: true });

const DailyProblemSet = mongoose.models.DailyProblemSet || mongoose.model('DailyProblemSet', dailyProblemSetSchema);

module.exports = async function handler(req, res) {
  // --- CORS ヘッダー ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // DB 接続
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI, { dbName: 'morning_challenge' });
    }

    if (req.method === 'GET') {
      const { date, difficulty } = req.query;
      if (!date || !difficulty) {
        return res.status(400).json({ success: false, error: 'date and difficulty are required' });
      }

      const doc = await DailyProblemSet.findOne({ date, difficulty });
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Not Found', message: '問題セットが見つかりません' });
      }

      return res.status(200).json({ success: true, data: doc.problems, date: doc.date, difficulty: doc.difficulty, isEdited: doc.isEdited });
    }

    if (req.method === 'POST') {
      const { date, difficulty, problems } = req.body || {};
      if (!date || !difficulty || !Array.isArray(problems)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      const updated = await DailyProblemSet.findOneAndUpdate(
        { date, difficulty },
        { problems, isEdited: true },
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