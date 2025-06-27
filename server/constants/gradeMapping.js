// Grade mapping constants for consistent display across the application

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

// Function to get grade label with fallback
const getGradeLabel = (grade) => {
  if (grade === null || grade === undefined) {
    return 'その他';
  }
  
  const gradeNum = parseInt(grade, 10);
  if (isNaN(gradeNum)) {
    return 'その他';
  }
  
  return GRADE_MAP[gradeNum] || 'その他';
};

// Function to normalize grade value
const normalizeGrade = (grade) => {
  if (grade === null || grade === undefined) {
    return null;
  }
  
  const gradeNum = parseInt(grade, 10);
  if (isNaN(gradeNum)) {
    return null;
  }
  
  return gradeNum;
};

module.exports = {
  GRADE_MAP,
  getGradeLabel,
  normalizeGrade
};