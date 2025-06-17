// API共通型定義
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

// 問題関連のAPI型
export interface ProblemApiResponse {
  id: string;
  question: string;
  answer: number;
  options?: number[];
  type?: string;
}

export interface ProblemsApiResponse extends ApiResponse<ProblemApiResponse[]> {
  problems?: ProblemApiResponse[];
}

// 認証関連のAPI型
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  username: string;
  grade?: number;
}

export interface AuthApiResponse extends ApiResponse {
  token?: string;
  user?: {
    _id: string;
    username: string;
    email: string;
    isAdmin?: boolean;
    grade?: number;
  };
}

// 結果送信用の型
export interface SubmitAnswersRequest {
  answers: string[];
  startTime: number;
  endTime: number;
  difficulty: string;
  date: string;
}

export interface SubmitAnswersResponse extends ApiResponse {
  results?: {
    totalProblems: number;
    correctAnswers: number;
    incorrectAnswers: number;
    unanswered: number;
    totalTime: number;
    timeSpent: number;
    score: number;
    difficulty: string;
    date: string;
    rank?: number;
    problems: Array<{
      problemId: string;
      question: string;
      userAnswer: number;
      correctAnswer: number;
      isCorrect: boolean;
      timeSpent: number;
    }>;
  };
}

// ランキング関連の型
export interface RankingEntry {
  _id: string;
  username: string;
  score: number;
  timeSpent: number;
  totalTime: number;
  rank?: number;
  date: string;
  difficulty: string;
}

export interface RankingApiResponse extends ApiResponse {
  data?: {
    data: RankingEntry[];
    total: number;
    page: number;
    limit: number;
  };
}

// 履歴関連の型
export interface HistoryEntry {
  _id: string;
  date: string;
  difficulty: string;
  totalProblems: number;
  correctAnswers: number;
  score: number;
  timeSpent: number;
  timestamp: string;
  rank?: number;
}

export interface HistoryApiResponse extends ApiResponse {
  history?: HistoryEntry[];
} 