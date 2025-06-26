import { GRADE_OPTIONS } from '../types/grades';

export const getGradeLabel = (grade: number | string): string => {
  const gradeOption = GRADE_OPTIONS.find(option => option.value === String(grade));
  return gradeOption ? gradeOption.label : `${grade}年生`;
};

export const getGradeDisplayName = (grade: number | string | undefined | null): string => {
  const num = grade === undefined || grade === null ? undefined : Number(grade);
  if (num === undefined || isNaN(num)) {
    return '未設定';
  }
  switch (num) {
    case 7:
      return 'その他';
    case 99:
      return 'ひみつ';
    default:
      return `${num}年生`;
  }
};

export const getGradeColor = (grade: number | string): string => {
  switch (Number(grade)) {
    case 1:
    case 2:
      return '#FF6B6B'; // 低学年 - 赤系
    case 3:
    case 4:
      return '#4ECDC4'; // 中学年 - 青緑系
    case 5:
    case 6:
      return '#45B7D1'; // 高学年 - 青系
    case 7:
      return '#96CEB4'; // その他 - 緑系
    case 99:
      return '#FFEAA7'; // ひみつ - 黄系
    default:
      return '#007AFF'; // デフォルト
  }
}; 