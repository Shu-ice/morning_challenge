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
  correctAnswer?: number;
  options?: number[];
  type?: string;
}

export interface GetProblemsRequest {
  difficulty: string;
  date?: string;
  skipTimeCheck?: boolean;
  userId?: string;
}

export interface GetProblemsResponse extends ApiResponse {
  difficulty: string;
  date: string;
  problems: Array<{
    id: string;
    question: string;
    options?: number[];
  }>;
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
  timeSpentMs: number;
  difficulty: string;
  date: string;
  userId?: string;
  problemIds?: string[];
}

export interface ProblemResult {
  id: number;
  question: string;
  userAnswer: number | null;
  correctAnswer: number;
  isCorrect: boolean;
  timeSpent: number;
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
    startTime: number;
    endTime: number;
    rank?: number;
    problems: ProblemResult[];
  };
}

// ランキング関連の型
export interface RankingEntry {
  _id?: string;
  userId?: string;
  username: string;
  avatar: string;
  grade: number;
  score: number;
  timeSpent: number;
  totalTime: number;
  correctAnswers: number;
  totalProblems: number;
  incorrectAnswers?: number;
  unanswered?: number;
  streak: number;
  rank?: number;
  date: string;
  difficulty: string;
}

export interface RankingApiResponse extends ApiResponse {
  count?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
  data?: RankingEntry[];
}

// 履歴関連の型
export interface HistoryEntry {
  _id: string;
  date: string;
  difficulty: string;
  totalProblems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  score: number;
  timeSpent: number;
  totalTime: number;
  timestamp?: string;
  createdAt: string;
  rank?: number;
  problems?: ProblemResult[];
}

export interface HistoryApiResponse extends ApiResponse {
  count?: number;
  data?: HistoryEntry[];
}

// 時間制限エラー用の型
export interface TimeRestrictionError extends ApiResponse {
  currentTime: number;
  allowedTime: string;
  isTimeRestricted: boolean;
} 