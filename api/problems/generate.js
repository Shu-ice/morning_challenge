// 📦 /api/problems/generate - Problem set generator for admin tool
const path = require('path');

// 既存の problems モジュールを再利用
const problemsModule = require(path.join('..', 'problems'));
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

    // 問題生成
    let problems = generateProblemSet(difficultyLower);
    if (Number.isFinite(count) && count > 0) {
      problems = problems.slice(0, count);
    }

    // TODO: DB 保存・重複チェック (force フラグ考慮) は別タスク

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