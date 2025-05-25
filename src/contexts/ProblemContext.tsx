import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Problem, ProblemResult, PracticeSession, DifficultyRank, ApiResult } from '../types';

interface ProblemContextType {
  currentProblem: Problem | null;
  currentSession: PracticeSession | null;
  results: ProblemResult[];
  setCurrentProblem: (problem: Problem | null) => void;
  startSession: (difficulty: DifficultyRank) => void;
  finalizeSession: (detailedResults: ProblemResult[], apiResult: ApiResult) => void;
  resetSession: () => void;
}

const ProblemContext = createContext<ProblemContextType | undefined>(undefined);

export const ProblemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [results, setResults] = useState<ProblemResult[]>([]);

  const startSession = (difficulty: DifficultyRank) => {
    const newSession: PracticeSession = {
      id: Date.now().toString(),
      userId: 'temp', // 実際のユーザーIDはAuthContextから取得
      startTime: new Date().toISOString(),
      difficulty,
      results: [],
      score: 0,
      endTime: undefined,
    };
    setCurrentSession(newSession);
    setResults([]);
  };

  const finalizeSession = (detailedResults: ProblemResult[], apiResult: ApiResult) => {
    if (currentSession) {
      const scoreFromServer = apiResult.score;
      
      // APIレスポンスからサーバー基準の startTime と endTime (数値タイムスタンプ) を取得
      const serverStartTimeMs = apiResult.startTime;
      const serverEndTimeMs = apiResult.endTime;
      const serverTotalTimeMs = apiResult.totalTime; // APIからtotalTimeを取得

      const finalSession: PracticeSession = {
        ...currentSession, // id, userId, difficulty は元のセッションのものを維持
        startTime: new Date(serverStartTimeMs).toISOString(), // サーバーの開始時刻 (ISO文字列に変換)
        endTime: new Date(serverEndTimeMs).toISOString(),   // サーバーの終了時刻 (ISO文字列に変換)
        results: detailedResults, // これは引数で渡ってくるのでそのまま使用
        score: scoreFromServer,
        totalTime: serverTotalTimeMs, // ★ totalTime を設定
      };
      setCurrentSession(finalSession);
      setResults(detailedResults); // results は問題ごとの詳細なので、これも引数のものをセット
      console.log('[ProblemContext] Session finalized with API results (using server times):', finalSession);
    }
  };

  const resetSession = () => {
    setCurrentProblem(null);
    setCurrentSession(null);
    setResults([]);
  };

  const calculateScore = (problemResults: ProblemResult[], difficulty: DifficultyRank): number => {
    if (!problemResults || problemResults.length === 0) return 0;

    const correctAnswers = problemResults.filter(r => r.isCorrect).length;
    const totalProblems = problemResults.length;

    let basePointsPerCorrect = 10;
    switch (difficulty) {
      case 'intermediate': basePointsPerCorrect = 15; break;
      case 'advanced': basePointsPerCorrect = 20; break;
      case 'expert': basePointsPerCorrect = 25; break;
    }
    let score = correctAnswers * basePointsPerCorrect;

    if (correctAnswers === totalProblems) {
      score += 20;
    }
    return score;
  };

  return (
    <ProblemContext.Provider
      value={{
        currentProblem,
        currentSession,
        results,
        setCurrentProblem,
        startSession,
        finalizeSession,
        resetSession,
      }}
    >
      {children}
    </ProblemContext.Provider>
  );
};

export const useProblem = () => {
  const context = useContext(ProblemContext);
  if (context === undefined) {
    throw new Error('useProblem must be used within a ProblemProvider');
  }
  return context;
}; 