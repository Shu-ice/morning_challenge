import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Problem, ProblemResult, PracticeSession, DifficultyRank } from '../types';

interface ProblemContextType {
  currentProblem: Problem | null;
  currentSession: PracticeSession | null;
  results: ProblemResult[];
  setCurrentProblem: (problem: Problem | null) => void;
  startSession: (difficulty: DifficultyRank) => void;
  endSession: (detailedResults: ProblemResult[]) => void;
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

  const endSession = (detailedResults: ProblemResult[]) => {
    if (currentSession) {
      const finalScore = calculateScore(detailedResults, currentSession.difficulty);
      const finalSession: PracticeSession = {
        ...currentSession,
        endTime: new Date().toISOString(),
        results: detailedResults,
        score: finalScore,
      };
      setCurrentSession(finalSession);
      setResults(detailedResults);
      console.log('[ProblemContext] Session ended with detailed results:', finalSession);
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
        endSession,
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