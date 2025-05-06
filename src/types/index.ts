import type { DifficultyRank } from './difficulty';

export type { DifficultyRank };

export interface Problem {
  id: string;
  question: string;
  answer: number;
  difficulty: DifficultyRank;
  options?: number[];
  explanation?: string;
}

export interface ProblemResult {
  problemId: string;
  question: string;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  timeSpent: number;
}

export interface PracticeSession {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  difficulty: DifficultyRank;
  results: ProblemResult[];
  score: number;
}

export interface UserProfile extends UserData {
  totalSessions: number;
  averageScore: number;
  bestScore: number;
  lastPracticeDate?: string;
}

export interface UserData {
  _id: string;
  username: string;
  email?: string;
  grade?: number | string;
  avatar?: string;
  isLoggedIn: boolean;
  loginTime?: string;
  isAdmin?: boolean;
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

// 問題の解答結果とセッション全体の集計結果を含む型
export interface Results {
  difficulty: DifficultyRank;
  totalProblems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalTime: number; // ミリ秒
  timeSpent: number; // 秒
  problems: ProblemResult[]; // 各問題の結果
  score: number;
  grade?: number | string; // ユーザーの学年
  rank?: number; // ランキング (あれば)
  date?: string; // YYYY-MM-DD 形式の日付
  // username?: string; // ユーザー名も必要なら追加
  // userId?: string; // ユーザーIDも必要なら追加
} 