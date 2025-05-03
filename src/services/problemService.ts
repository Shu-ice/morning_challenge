import apiService from './apiService';

/**
 * 問題関連の処理を行うサービスクラス
 */
class ProblemService {
  // 指定された学年の問題を生成
  async generateProblems(grade) {
    try {
      return await apiService.get(`/problems/generate/${grade}`);
    } catch (error) {
      throw error;
    }
  }
  
  // 問題の詳細を取得
  async getProblem(problemId) {
    try {
      return await apiService.get(`/problems/${problemId}`);
    } catch (error) {
      throw error;
    }
  }
  
  // 問題の答えを検証（練習モード）
  async checkAnswer(problemId, answer) {
    try {
      return await apiService.post(`/problems/check/${problemId}`, { answer });
    } catch (error) {
      throw error;
    }
  }
  
  // 練習用の問題を取得（時間制限なし）
  async getPracticeProblems(grade) {
    try {
      return await apiService.get(`/problems/practice/${grade}`);
    } catch (error) {
      throw error;
    }
  }
  
  // ローカルで問題回答・採点結果を処理
  processAnswers(problems, userAnswers) {
    // 問題と回答を突き合わせて結果を作成
    return problems.map((problem, index) => {
      const userAnswer = userAnswers[index] !== undefined 
        ? parseInt(userAnswers[index])
        : undefined;
      
      return {
        problemId: problem.id,
        question: problem.question,
        userAnswer,
        isCorrect: userAnswer === problem.answer,
        timeSpent: 0 // タイマー機能で実装
      };
    });
  }
  
  // スコアを計算
  calculateScore(correctCount, totalTime) {
    // 正解数に基づく基本スコア
    const baseScore = correctCount * 100;
    
    // 時間ボーナス: 速ければ速いほど高得点
    // 1問あたり60秒を想定
    const maxExpectedTime = 10 * 60; // 10問で10分
    const timeRatio = Math.min(1, totalTime / maxExpectedTime);
    const timeBonus = Math.round((1 - timeRatio) * 500); // 最大500点のボーナス
    
    return baseScore + timeBonus;
  }
}

export default new ProblemService();