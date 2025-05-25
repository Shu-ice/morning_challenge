/**
 * スコア計算関数
 * @param {number} correctCount - 正解数
 * @param {number} totalProblems - 問題数
 * @param {number} timeSpent - 回答にかかった合計時間（秒）
 * @param {string} difficulty - 難易度（'beginner' | 'intermediate' | 'advanced' | 'expert'）
 * @returns {number} スコア
 */
export function calculateScore(correctCount, totalProblems, timeSpent, difficulty) {
  // 難易度ごとの倍率
  const difficultyMultiplier = {
    beginner: 1,
    intermediate: 1.5,
    advanced: 2,
    expert: 3
  };
  const multiplier = difficultyMultiplier[difficulty] || 1;
  // 正答率
  const accuracy = totalProblems > 0 ? correctCount / totalProblems : 0;
  // 時間ボーナス（速いほど高得点、最低1点）
  const timeBonus = Math.max(1, 60 - timeSpent); // 60秒以内ならボーナス
  // 総合スコア
  const score = Math.round((accuracy * 100 + timeBonus) * multiplier);
  return score;
} 