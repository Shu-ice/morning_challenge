interface UserPerformance {
  recentScores: number[];
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  averageScore: number;
  totalAttempts: number;
  learningTrend: 'improving' | 'stable' | 'declining';
}

interface DifficultyAdjustment {
  targetDifficulty: number;
  reason: string;
  confidenceLevel: number;
  suggestedProblemTypes: string[];
}

export class AdaptiveDifficultySystem {
  private static readonly MIN_DIFFICULTY = 1;
  private static readonly MAX_DIFFICULTY = 5;
  private static readonly PERFORMANCE_WINDOW = 10; // 直近10問の結果を分析
  private static readonly TRENDING_WINDOW = 5; // 傾向分析用

  /**
   * ユーザーの履歴データから適切な難易度を算出
   */
  static calculateOptimalDifficulty(
    userGrade: number,
    recentResults: Array<{ score: number; difficulty: number; timestamp: string }>
  ): DifficultyAdjustment {
    if (recentResults.length === 0) {
      return this.getInitialDifficulty(userGrade);
    }

    const performance = this.analyzePerformance(recentResults);
    const currentDifficulty = recentResults[0]?.difficulty || this.getBaseDifficultyForGrade(userGrade);
    
    return this.determineAdjustment(performance, currentDifficulty, userGrade);
  }

  /**
   * 初回ユーザーの基本難易度設定
   */
  private static getInitialDifficulty(userGrade: number): DifficultyAdjustment {
    const baseDifficulty = this.getBaseDifficultyForGrade(userGrade);
    
    return {
      targetDifficulty: baseDifficulty,
      reason: `${userGrade}年生の標準レベルからスタート`,
      confidenceLevel: 0.7,
      suggestedProblemTypes: this.getProblemTypesForGrade(userGrade)
    };
  }

  /**
   * 学年に応じた基本難易度
   */
  private static getBaseDifficultyForGrade(userGrade: number): number {
    const gradeMap: Record<number, number> = {
      1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3,
      7: 2, 8: 2 // その他・ひみつ
    };
    return gradeMap[userGrade] || 2;
  }

  /**
   * 学年に応じた推奨問題タイプ
   */
  private static getProblemTypesForGrade(userGrade: number): string[] {
    const typeMap: Record<number, string[]> = {
      1: ['addition', 'subtraction', 'counting'],
      2: ['addition', 'subtraction', 'simple_multiplication'],
      3: ['multiplication', 'division', 'word_problems'],
      4: ['multiplication', 'division', 'fractions', 'word_problems'],
      5: ['fractions', 'decimals', 'area', 'complex_word_problems'],
      6: ['fractions', 'decimals', 'ratios', 'geometry', 'algebra_basics'],
      7: ['mixed_review', 'adaptive_selection'],
      8: ['mixed_review', 'adaptive_selection']
    };
    return typeMap[userGrade] || ['mixed_review'];
  }

  /**
   * パフォーマンス分析
   */
  private static analyzePerformance(results: Array<{ score: number; difficulty: number; timestamp: string }>): UserPerformance {
    const recentResults = results.slice(0, this.PERFORMANCE_WINDOW);
    const recentScores = recentResults.map(r => r.score);
    
    const averageScore = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    
    let consecutiveCorrect = 0;
    let consecutiveIncorrect = 0;
    
    for (const result of recentResults) {
      if (result.score >= 80) {
        consecutiveCorrect++;
        consecutiveIncorrect = 0;
      } else {
        consecutiveIncorrect++;
        consecutiveCorrect = 0;
      }
      if (consecutiveCorrect > 0 && consecutiveIncorrect > 0) break;
    }

    const learningTrend = this.calculateTrend(recentResults.slice(0, this.TRENDING_WINDOW));

    return {
      recentScores,
      consecutiveCorrect,
      consecutiveIncorrect,
      averageScore,
      totalAttempts: results.length,
      learningTrend
    };
  }

  /**
   * 学習トレンド計算
   */
  private static calculateTrend(results: Array<{ score: number; difficulty: number; timestamp: string }>): 'improving' | 'stable' | 'declining' {
    if (results.length < 3) return 'stable';

    const scores = results.map(r => r.score);
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    const improvement = secondAvg - firstAvg;
    
    if (improvement > 10) return 'improving';
    if (improvement < -10) return 'declining';
    return 'stable';
  }

  /**
   * 難易度調整の判定
   */
  private static determineAdjustment(
    performance: UserPerformance,
    currentDifficulty: number,
    userGrade: number
  ): DifficultyAdjustment {
    let targetDifficulty = currentDifficulty;
    let reason = '';
    let confidenceLevel = 0.5;
    
    if (performance.consecutiveCorrect >= 3 && performance.averageScore >= 85) {
      targetDifficulty = Math.min(this.MAX_DIFFICULTY, currentDifficulty + 1);
      reason = `連続${performance.consecutiveCorrect}問正解、難易度を上げて挑戦しましょう！`;
      confidenceLevel = 0.8;
    }
    else if (performance.consecutiveIncorrect >= 3 && performance.averageScore < 60) {
      targetDifficulty = Math.max(this.MIN_DIFFICULTY, currentDifficulty - 1);
      reason = `少し難しいようです。基礎を固めてから挑戦しましょう！`;
      confidenceLevel = 0.9;
    }
    else if (performance.learningTrend === 'improving' && performance.averageScore >= 75) {
      targetDifficulty = Math.min(this.MAX_DIFFICULTY, currentDifficulty + 1);
      reason = '上達しています！次のレベルに挑戦してみましょう！';
      confidenceLevel = 0.7;
    }
    else if (performance.learningTrend === 'declining' && performance.averageScore < 65) {
      targetDifficulty = Math.max(this.MIN_DIFFICULTY, currentDifficulty - 1);
      reason = '復習をして基礎を固めましょう';
      confidenceLevel = 0.6;
    }
    else if (performance.averageScore >= 70 && performance.averageScore <= 85) {
      reason = '現在のレベルで安定して解けています';
      confidenceLevel = 0.8;
    }
    
    const maxForGrade = this.getMaxDifficultyForGrade(userGrade);
    targetDifficulty = Math.min(targetDifficulty, maxForGrade);
    
    return {
      targetDifficulty,
      reason: reason || '現在のレベルを継続',
      confidenceLevel,
      suggestedProblemTypes: this.getProblemTypesForDifficulty(targetDifficulty, userGrade)
    };
  }

  private static getMaxDifficultyForGrade(userGrade: number): number {
    const maxMap: Record<number, number> = {
      1: 2, 2: 3, 3: 4, 4: 4, 5: 5, 6: 5,
      7: 5, 8: 5
    };
    return maxMap[userGrade] || 3;
  }

  private static getProblemTypesForDifficulty(difficulty: number, userGrade: number): string[] {
    const baseTypes = this.getProblemTypesForGrade(userGrade);
    
    if (difficulty >= 4) {
      return [...baseTypes, 'challenge_problems', 'logic_puzzles'];
    } else if (difficulty >= 3) {
      return [...baseTypes, 'word_problems'];
    } else {
      return baseTypes.filter(type => !type.includes('complex'));
    }
  }

  static generateEncouragementMessage(performance: UserPerformance, adjustment: DifficultyAdjustment): string {
    const messages = {
      improving: [
        '🌟 素晴らしい成長です！その調子で頑張りましょう！',
        '📈 確実に上達していますね！次の挑戦も楽しみです！',
        '🚀 どんどん上手になっています！'
      ],
      stable: [
        '⭐ 安定した実力ですね！継続は力なり！',
        '💪 しっかりとした基礎力が身についています！',
        '👍 現在のペースを維持して頑張りましょう！'
      ],
      declining: [
        '🌱 焦らずに基礎から丁寧に取り組みましょう！',
        '💝 一歩一歩確実に進んでいけば大丈夫！',
        '🤝 復習をして確実な理解を深めましょう！'
      ]
    };

    const trendMessages = messages[performance.learningTrend];
    const randomMessage = trendMessages[Math.floor(Math.random() * trendMessages.length)];
    
    return `${randomMessage}\n\n${adjustment.reason}`;
  }

  static getProblemGenerationParams(userGrade: number, targetDifficulty: number) {
    return {
      grade: userGrade,
      difficulty: targetDifficulty,
      problemTypes: this.getProblemTypesForDifficulty(targetDifficulty, userGrade),
      adaptiveHints: targetDifficulty <= 2,
      timeLimit: this.getTimeLimitForDifficulty(targetDifficulty),
      scaffolding: targetDifficulty <= 2
    };
  }

  private static getTimeLimitForDifficulty(difficulty: number): number {
    const timeMap: Record<number, number> = {
      1: 180, 2: 150, 3: 120, 4: 90, 5: 60
    };
    return timeMap[difficulty] || 120;
  }
} 