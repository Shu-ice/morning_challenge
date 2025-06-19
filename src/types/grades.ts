export const GRADE_OPTIONS = [
  { value: '1', label: '小学1年生' },
  { value: '2', label: '小学2年生' },
  { value: '3', label: '小学3年生' },
  { value: '4', label: '小学4年生' },
  { value: '5', label: '小学5年生' },
  { value: '6', label: '小学6年生' },
  { value: '7', label: 'その他' },
  { value: '999', label: 'ひみつ' }, // 特別な学年999
];

// GradeValue 型も新しい選択肢を含めて更新
export type GradeValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 999 | string | undefined; 