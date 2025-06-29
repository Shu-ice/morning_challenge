import { useState, useCallback } from 'react';
import type { DifficultyRank } from '../types/difficulty';

export interface GameState {
  isStarted: boolean;
  currentProblemIndex: number;
  answers: (string | null)[];
  selectedDate: string | null;
  difficulty: DifficultyRank;
}

interface UseGameStateOptions {
  difficulty: DifficultyRank;
  totalProblems: number;
}

export const useGameState = ({ difficulty, totalProblems }: UseGameStateOptions) => {
  const [gameState, setGameState] = useState<GameState>({
    isStarted: false,
    currentProblemIndex: 0,
    answers: Array(totalProblems).fill(null),
    selectedDate: null,
    difficulty
  });

  const startGame = useCallback(() => {
    setGameState(prev => ({ ...prev, isStarted: true }));
  }, []);

  const resetGame = useCallback(() => {
    setGameState({
      isStarted: false,
      currentProblemIndex: 0,
      answers: Array(totalProblems).fill(null),
      selectedDate: null,
      difficulty
    });
  }, [difficulty, totalProblems]);

  const setCurrentProblem = useCallback((index: number) => {
    setGameState(prev => ({
      ...prev,
      currentProblemIndex: Math.max(0, Math.min(index, totalProblems - 1))
    }));
  }, [totalProblems]);

  const nextProblem = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      currentProblemIndex: Math.min(prev.currentProblemIndex + 1, totalProblems - 1)
    }));
  }, [totalProblems]);

  const previousProblem = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      currentProblemIndex: Math.max(prev.currentProblemIndex - 1, 0)
    }));
  }, []);

  const setAnswer = useCallback((index: number, answer: string | null) => {
    setGameState(prev => {
      const newAnswers = [...prev.answers];
      newAnswers[index] = answer;
      return { ...prev, answers: newAnswers };
    });
  }, []);

  const setSelectedDate = useCallback((date: string | null) => {
    setGameState(prev => ({ ...prev, selectedDate: date }));
  }, []);

  const isComplete = gameState.answers.every(answer => answer !== null && answer.trim() !== '');
  const progress = gameState.answers.filter(answer => answer !== null && answer.trim() !== '').length;

  return {
    gameState,
    startGame,
    resetGame,
    setCurrentProblem,
    nextProblem,
    previousProblem,
    setAnswer,
    setSelectedDate,
    isComplete,
    progress
  };
};