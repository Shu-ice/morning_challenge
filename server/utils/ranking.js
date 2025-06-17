import Result from '../models/Result.js';

/**
 * 指定した結果のランキング順位を計算
 * @param {object} result - 保存済みのResultドキュメント
 * @returns {Promise<number|null>} 順位（1始まり）
 */
export async function getRankForResult(result) {
  if (!result || !result.date || !result.difficulty) return null;
  // 同じ日・難易度の結果をスコア降順・タイム昇順で取得
  const sameDayResults = await Result.find({
    date: result.date,
    difficulty: result.difficulty
  }).sort({ score: -1, timeSpent: 1, createdAt: 1 });
  const rank = sameDayResults.findIndex(r => r._id.toString() === result._id.toString()) + 1;
  return rank > 0 ? rank : null;
} 