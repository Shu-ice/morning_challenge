// 難易度ランク
export type DifficultyRank = 'beginner' | 'intermediate' | 'advanced' | 'expert';

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