// 📦 /api/problems/generate - Problem set generator for admin tool
const path = require('path');
const mongoose = require('mongoose');

// 既存の problems モジュールを再利用
const problemsModule = require('./index');

const dailyProblemSetSchema = new mongoose.Schema({
  date: { type: String, required: true },
  difficulty: { type: String, required: true },
  problems: { type: Array, required: true },
  isEdited: { type: Boolean, default: false }
}, { timestamps: true });

const DailyProblemSet = mongoose.models.DailyProblemSet || mongoose.model('DailyProblemSet', dailyProblemSetSchema);

const generateProblemSet = problemsModule.generateProblemSet || (() => []);

// 有効な難易度リスト（problems.js と同期）
const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'];

module.exports = async function handler(req, res) {
  // --- CORS ヘッダー ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { difficulty = 'beginner', count = 10, date, force = false } = req.body || {};

    // 難易度バリデーション
    const difficultyLower = String(difficulty).toLowerCase();
    if (!VALID_DIFFICULTIES.includes(difficultyLower)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid difficulty level',
        validDifficulties: VALID_DIFFICULTIES
      });
    }

    // MongoDB 接続（キャッシュ済み接続を使用）
    const { connectMongoose } = require('../_lib/database');
    await connectMongoose();

    // 既存チェック
    const existing = await DailyProblemSet.findOne({ date: date || new Date().toISOString().slice(0,10), difficulty: difficultyLower });
    if (existing && !force) {
      return res.status(409).json({ success: false, error: 'Already exists', message: '既に問題セットが存在します', requestId: null });
    }

    // 問題生成
    let problems = generateProblemSet(difficultyLower);
    if (Number.isFinite(count) && count > 0) {
      problems = problems.slice(0, count);
    }

    // DB 保存
    await DailyProblemSet.findOneAndUpdate(
      { date: date || new Date().toISOString().slice(0,10), difficulty: difficultyLower },
      { problems, isEdited: false },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Generated ${problems.length} problems for ${difficultyLower}`,
      problems,
      count: problems.length,
      difficulty: difficultyLower,
      date: date || new Date().toISOString().slice(0, 10),
      forceApplied: !!force,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[generate] Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}; 