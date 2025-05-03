import { DifficultyRank } from '@/types/difficulty';

export interface Problem {
  question: string
  answer: number
  options: number[]
}

export interface Results {
  totalProblems: number
  correctAnswers: number
  timeSpent: number
  difficulty: DifficultyRank
  rank?: number
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface UserData {
  username: string
  email?: string
  grade?: string
  isLoggedIn: boolean
  loginTime: string
} 