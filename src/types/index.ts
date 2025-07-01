import type { DifficultyRank } from './difficulty';

export type { DifficultyRank };

export interface Problem {
  id: string;
  question: string;
  answer: number;
  difficulty: DifficultyRank;
  options?: number[];
  explanation?: string;
  type?: string;
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
  totalTime?: number; // ミリ秒単位の合計解答時間
}

export interface UserProfile extends UserData {
  totalSessions: number;
  averageCorrectRate: number;
  bestCorrectRate: number;
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
  totalQuestions: number; // totalProblemsと同様だが、別名でアクセスされる場合に対応
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalTime: number; // ミリ秒
  timeSpent: number; // 秒
  problems: ProblemResult[]; // 各問題の結果
  results: ProblemResult[]; // problemsと同じだが、別名でアクセスされる場合に対応
  grade?: number | string; // ユーザーの学年
  rank?: number; // ランキング (あれば)
  date?: string; // YYYY-MM-DD 形式の日付
  // username?: string; // ユーザー名も必要なら追加
  // userId?: string; // ユーザーIDも必要なら追加
}

// APIレスポンスの result 部分の型 (submitAnswers)
export interface ApiResult {
  _id?: string; // _id はランキングや履歴用で、submit直後にはない可能性も考慮
  userId?: string;
  username?: string;
  totalProblems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalTime: number;    // ミリ秒単位の合計解答時間 (サーバーレスポンスの totalTime)
  timeSpent: number;    // 秒単位の合計解答時間 (totalTime / 1000) (サーバーレスポンスの timeSpent)
  results: ProblemResult[]; // 詳細な問題ごとの結果 (サーバーレスポンスの problems) - Note: renamed from 'problems' to 'results' for consistency
  difficulty: DifficultyRank; 
  date: string;
  startTime?: number; // サーバーで計算された開始時刻 (ミリ秒タイムスタンプ)
  endTime?: number;   // サーバーで計算された終了時刻 (ミリ秒タイムスタンプ)
  rank?: number;
  score?: number; // スコア情報を追加
}

// API共通レスポンス型
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

// 問題取得APIレスポンス型
export interface ProblemsApiResponse {
  success: boolean;
  problems: Problem[];
  message?: string;
}

// 回答送信APIレスポンス型
export interface SubmitAnswersApiResponse {
  success: boolean;
  results: ApiResult;
  message?: string;
  rank?: number;
}

// エラーレスポンス型
export interface ErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  msg: string;
}

// ランキングAPIレスポンス型
export interface RankingApiResponse {
  success: boolean;
  users: RankingUser[];
  message?: string;
}

export interface RankingUser {
  _id: string;
  username: string;
  avatar?: string;
  grade?: number;
  points?: number;
}

// プロフィール更新APIレスポンス型
export interface ProfileUpdateApiResponse {
  success: boolean;
  user: UserData;
  message?: string;
}

// 認証関連の型定義
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  grade?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ProfileUpdateData {
  grade?: number;
  avatar?: string;
}

// HTTP Request type for error handling
export interface HttpRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

// Logger argument types
export type LoggerArgs = (string | number | boolean | object | Error | null | undefined)[];

// History API response type
export interface HistoryApiResponse {
  success: boolean;
  history: HistoryItem[];
  currentStreak?: number;
  maxStreak?: number;
  message?: string;
}

// History item type
export interface HistoryItem {
  _id?: string;
  date: string;
  difficulty: DifficultyRank;
  timeSpent: number;
  totalTime?: number;
  correctAnswers: number;
  totalProblems: number;
  incorrectAnswers?: number;
  unanswered?: number;
  rank?: number;
  timestamp?: string;
  createdAt?: string;
  userId?: string;
  username?: string;
  grade?: number;
  problems?: ProblemResult[];
}

// 回答送信データ型
export interface SubmitAnswersRequest {
  difficulty: DifficultyRank;
  date: string;
  problemIds: string[];
  answers: string[];
  timeSpentMs: number;
  userId: string;
}