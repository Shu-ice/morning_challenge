// Grade mapping utilities for Vercel serverless functions
// Keep independent from server-side implementation to avoid bundling issues.

const GRADE_MAP = {
  1: '小1年生',
  2: '小2年生',
  3: '小3年生',
  4: '小4年生',
  5: '小5年生',
  6: '小6年生',
  7: 'その他',
  8: '中1年生',
  9: '中2年生',
  10: '中3年生',
  11: '高1年生',
  12: '高2年生',
  13: '高3年生',
  14: '大学生',
  15: '社会人',
  99: 'ひみつ'
};

/**
 * 学年数値から日本語ラベルを取得
 * @param {number|string|null|undefined} grade
 * @returns {string}
 */
function getGradeLabel(grade) {
  if (grade === null || grade === undefined) return 'その他';
  const num = parseInt(grade, 10);
  if (Number.isNaN(num)) return 'その他';
  return GRADE_MAP[num] || 'その他';
}

/**
 * 学年値を数値に正規化
 * @param {number|string|null|undefined} grade
 * @returns {number|null}
 */
function normalizeGrade(grade) {
  if (grade === null || grade === undefined) return null;
  const num = parseInt(grade, 10);
  return Number.isNaN(num) ? null : num;
}

module.exports = {
  GRADE_MAP,
  getGradeLabel,
  normalizeGrade
}; 