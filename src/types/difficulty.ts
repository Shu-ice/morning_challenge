// 難易度の型定義
export type DifficultyRank = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// 難易度ラベルのマッピング（バックエンドの新しい基準に合わせて）
export const DIFFICULTY_LABELS: Record<DifficultyRank, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  expert: '超級'
};

// 各難易度の詳細情報
export const DIFFICULTY_INFO: Record<DifficultyRank, {
  title: string;
  reading: string;
  description: string;
  recommendation: string;
  problems: string;
}> = {
  beginner: {
    title: '初級',
    reading: 'しょきゅう',
    description: '基本的な計算問題',
    recommendation: '2～3年生におすすめ',
    problems: "たし算・ひき算：2～3けた\nかけ算：1けた（九九）"
  },
  intermediate: {
    title: '中級',
    reading: 'ちゅうきゅう',
    description: '少し難しい計算問題',
    recommendation: '4～5年生におすすめ',
    problems: "たし算・ひき算：4けた\nかけ算：2～3けた\nわり算：3けた÷1けた・3けた÷2けた"
  },
  advanced: {
    title: '上級',
    reading: 'じょうきゅう',
    description: '高度な計算問題',
    recommendation: '6年生におすすめ',
    problems: "たし算・ひき算：5けた\nかけ算：4けた\nわり算：4けた÷2けた・5けた÷3けた"
  },
  expert: {
    title: '超級',
    reading: 'ちょうきゅう',
    description: '最高難易度の計算問題',
    recommendation: 'さらなる高みをめざす方におすすめ',
    problems: "たし算・ひき算：6けた\nかけ算：5けた\nわり算：5けた÷3けた・6けた÷4けた"
  }
};

export const DIFFICULTY_COLORS: Record<DifficultyRank, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-blue-100 text-blue-800',
  advanced: 'bg-yellow-100 text-yellow-800',
  expert: 'bg-red-100 text-red-800'
};

// 難易度名の変換（表示用）
export const difficultyToJapanese = (difficulty: DifficultyRank): string => {
  switch (difficulty) {
    case 'beginner': return '初級';
    case 'intermediate': return '中級';
    case 'advanced': return '上級';
    case 'expert': return '超級';
    default: return '不明';
  }
};

// 日本語から難易度への変換
export const japaneseToDifficulty = (japanese: string): DifficultyRank => {
  switch (japanese) {
    case '初級': return 'beginner';
    case '中級': return 'intermediate';
    case '上級': return 'advanced';
    case '超級': return 'expert';
    default: return 'beginner';
  }
}; 