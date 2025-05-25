// 難易度ランク
export type DifficultyRank = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const DIFFICULTY_LABELS: Record<DifficultyRank, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  expert: '超級'
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