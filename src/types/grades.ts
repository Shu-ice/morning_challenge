export const GRADE_OPTIONS = [
  { value: '1', label: '小学1年生' },
  { value: '2', label: '小学2年生' },
  { value: '3', label: '小学3年生' },
  { value: '4', label: '小学4年生' },
  { value: '5', label: '小学5年生' },
  { value: '6', label: '小学6年生' },
  { value: '7', label: 'その他' },
  { value: '8', label: '中学1年生' },
  { value: '9', label: '中学2年生' },
  { value: '10', label: '中学3年生' },
  { value: '11', label: '高校1年生' },
  { value: '12', label: '高校2年生' },
  { value: '13', label: '高校3年生' },
  { value: '14', label: '大学生' },
  { value: '15', label: '社会人' },
  { value: '99', label: 'ひみつ' },
];

// GradeValue 型も新しい選択肢を含めて更新
export type GradeValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 99 | string | undefined; 