export const GRADE_OPTIONS = [
  { value: '1', label: '小学1年生' },
  { value: '2', label: '小学2年生' },
  { value: '3', label: '小学3年生' },
  { value: '4', label: '小学4年生' },
  { value: '5', label: '小学5年生' },
  { value: '6', label: '小学6年生' },
];

// GradeValue 型も 1-6 の数値または対応する文字列に限定
// (ProfilePage側で String() しているため、文字列も許容する方が互換性が高い)
export type GradeValue = 1 | 2 | 3 | 4 | 5 | 6 | string | undefined; 