import type { DifficultyRank } from './difficulty';

export interface Problem {
  question: string;
  answer: number;
}

export interface ProblemResult {
  id: number;
  question: string;
  userAnswer: number | null;
  correctAnswer: number;
  isCorrect: boolean;
  timeSpent: number;
}

export interface Results {
  totalProblems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalTime: number;
  timeSpent: number;
  grade: number;
  problems: ProblemResult[];
  score: number;
  difficulty: DifficultyRank;
  rank?: number;
}

export interface UserData {
  username: string;
  isLoggedIn: boolean;
  grade?: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
} 