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
  totalTime?: number; // ミリ秒単位の合計解答時間
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

// APIレスポンスの result 部分の型 (submitAnswers)
export interface ApiResult {
  _id?: string; // _id はランキングや履歴用で、submit直後にはない可能性も考慮
  userId?: string;
  username?: string;
  // problemResults: ProblemResult[]; // これは results.problems にあるので、ApiResult直下には不要かも。
                                     // Problems.tsxのログでは APIレスポンスの `results` オブジェクトがこの型に相当し、
                                     // その中に `problems` 配列がある。
  totalProblems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalTime: number;    // ミリ秒単位の合計解答時間 (サーバーレスポンスの totalTime)
  timeSpent: number;    // 秒単位の合計解答時間 (totalTime / 1000) (サーバーレスポンスの timeSpent)
  problems: ProblemResult[]; // 詳細な問題ごとの結果 (サーバーレスポンスの problems)
  score: number;
  difficulty: DifficultyRank; 
  date: string;
  startTime: number; // サーバーで計算された開始時刻 (ミリ秒タイムスタンプ)
  endTime: number;   // サーバーで計算された終了時刻 (ミリ秒タイムスタンプ)
  rank?: number;
  // rank?: number; // ランキングはレスポンスのトップレベルにあることが多い <- これはApiResultには不要で、SubmitApiResponseのような親の型で持つべき
} 