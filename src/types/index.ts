import type { DifficultyRank } from './difficulty';

export interface Problem {
  _id?: string;
  question: string;
  answer: number;
  grade?: number;
  type?: string;
  difficulty?: DifficultyRank;
  date?: string;
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
  email?: string;
  grade?: number;
  loginTime?: string;
  isAdmin?: boolean;
  userId?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// Login APIからのレスポンスデータの型定義
export interface LoginResponseData {
  success: boolean;
  token: string;
  user: UserData;
  message?: string;
} 