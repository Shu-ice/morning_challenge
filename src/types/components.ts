import { UserData, Problem, ProblemResult, DifficultyRank } from './index';

export interface LoginProps {
  onLogin: (userData: UserData, token: string) => void;
  onRegister: () => void;
}

export interface RegisterProps {
  onRegister: (userData: UserData, token: string) => void;
  onLogin: () => void;
}

export interface HomeProps {
  onStartPractice: (difficulty: DifficultyRank) => void;
  isTimeValid: boolean;
  defaultDifficulty: DifficultyRank;
}

export interface ProblemsProps {
  difficulty: DifficultyRank;
  onComplete: (results: ProblemResult[]) => void;
  onBack: () => void;
}

export interface ResultsProps {
  results: ProblemResult[];
  onViewRankings: () => void;
  onBackToHome: () => void;
}

export interface RankingsProps {
  // 必要に応じてpropsを追加
}

export interface UserHistoryProps {
  // 必要に応じてpropsを追加
}

export interface ProfilePageProps {
  user: UserData;
  onLogout: () => void;
  onViewHistory: () => void;
  onSaveProfile: (userData: Partial<UserData>) => void;
}

export interface AdminDashboardProps {
  // 必要に応じてpropsを追加
}

export interface ProblemGeneratorProps {
  // 必要に応じてpropsを追加
}

export interface ProblemEditorProps {
  // 必要に応じてpropsを追加
} 