import apiService from './apiService';
import { DifficultyRank } from '../types/difficulty';

// 型定義を追加
interface Problem {
  id: string;
  question: string;
  answer: number;
  options?: number[];
  difficulty?: DifficultyRank;
  explanation?: string;
}

interface ProblemResult {
  problemId: string;
  answer: number;
  userAnswer: number;
  isCorrect: boolean;
  timeSpent: number;
}

/**
 * 問題関連の処理を行うサービスクラス
 */
class ProblemService {
  // 問題生成
  async generateProblems(grade: number | string) {
    try {
      const response = await apiService.post('/problems/generate', { grade });
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // 問題取得
  async getProblem(problemId: string) {
    try {
      const response = await apiService.get(`/problems/${problemId}`);
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // 回答チェック
  async checkAnswer(problemId: string, answer: number | string) {
    try {
      const response = await apiService.post(`/problems/${problemId}/check`, { answer });
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // 練習問題取得
  async getPracticeProblems(grade: number | string) {
    try {
      const response = await apiService.get(`/problems/practice/${grade}`);
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // 回答処理
  processAnswers(problems: Problem[], userAnswers: (number | string)[]) {
    if (!Array.isArray(problems) || !Array.isArray(userAnswers)) return [];
    return problems.map((problem: Problem, index: number) => {
      const userAnswer = userAnswers[index];
      const isCorrect = problem.answer === Number(userAnswer);
      
      return {
        problemId: problem.id,
        question: problem.question,
        correctAnswer: problem.answer,
        userAnswer: Number(userAnswer),
        isCorrect,
        options: problem.options
      };
    });
  }
  

}

export default new ProblemService();