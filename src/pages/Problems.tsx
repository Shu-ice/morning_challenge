import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import '../styles/Problems.css';
import type { Problem, ProblemResult, Results, UserData, ApiResult, SubmitAnswersRequest } from '../types/index';
import { problemsAPI } from '../api/index';
import { DifficultyRank, difficultyToJapanese, DIFFICULTY_INFO } from '../types/difficulty';
import { useProblem } from '../contexts/ProblemContext';
import axios, { isAxiosError } from 'axios';

// New components and hooks
import { useGameTimer } from '../hooks/useGameTimer';
import { useGameState } from '../hooks/useGameState';
import { CountdownTimer } from '../components/CountdownTimer';
import { GameProgress } from '../components/GameProgress';
import { ProblemDisplay } from '../components/ProblemDisplay';
import { AnswerInput } from '../components/AnswerInput';
import { GameControls } from '../components/GameControls';
import { MobileTimer } from '../components/MobileTimer';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader, { ProblemSkeleton } from '../components/SkeletonLoader';
import ProgressIndicator from '../components/ProgressIndicator';
import useApiWithRetry from '../hooks/useApiWithRetry';

import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { QUERY_KEYS } from '../hooks/useApiQuery';
import { getTodayJST } from '@/utils/dateUtils';

interface ProblemsProps {
  difficulty: DifficultyRank;
  onComplete: (apiResult: ApiResult) => void;
  onBack: () => void;
}

interface CompletionItem {
  date: string;
  difficulty: DifficultyRank;
  username: string;
  timestamp: string;
}

// Total number of problems per game
const TOTAL_PROBLEMS = 10;

// Utility functions
const getJSTDateString = () => {
  const jstDate = new Date(Date.now() + 9*60*60*1000);
  return jstDate.toISOString().slice(0, 10);
};

const getUserData = (): UserData | null => {
  const possibleKeys = ['userData', 'user', 'currentUser'];
  for (const key of possibleKeys) {
    try {
      const str = localStorage.getItem(key);
      if (str) {
        return JSON.parse(str) as UserData;
      }
    } catch (e) {
      logger.error(`[getUserData] Failed to parse ${key}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return null;
};

const saveCompletionData = (difficulty: DifficultyRank, user: UserData | null) => {
  if (!user?.username) {
    logger.warn('[saveCompletionData] User or username is missing, cannot save completion.');
    return;
  }

  try {
    const completionData = localStorage.getItem('mathChallengeCompletion');
    const parsedData = completionData ? JSON.parse(completionData) : [];
    
    const newCompletion: CompletionItem = {
      date: getJSTDateString(),
      difficulty,
      username: user.username,
      timestamp: new Date().toISOString()
    };

    parsedData.push(newCompletion);
    localStorage.setItem('mathChallengeCompletion', JSON.stringify(parsedData));
    logger.info(`[saveCompletionData] Completion saved for ${user.username} at ${difficulty} difficulty`);
  } catch (error) {
    logger.error('[saveCompletionData] Failed to save completion data:', error instanceof Error ? error : String(error));
  }
};

const Problems: React.FC<ProblemsProps> = ({ difficulty, onComplete, onBack }) => {
  // Hooks
  const queryClient = useQueryClient();
  const { elapsedTime, startTimer, stopTimer, resetTimer, formatTime } = useGameTimer();
  const { gameState, startGame, resetGame, setCurrentProblem, nextProblem, previousProblem, setAnswer, isComplete, progress } = useGameState({
    difficulty,
    totalProblems: TOTAL_PROBLEMS
  });

  // Local state
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // Refs for adaptive timer positioning
  const answerInputRef = useRef<HTMLInputElement>(null);

  const { execute: executeLoadProblems } = useApiWithRetry(() => 
    problemsAPI.getProblems(difficulty, getTodayJST()), { maxRetries: 3 }
  );

  // Load problems when component mounts
  useEffect(() => {
    loadProblems();
  }, [difficulty]);

  // Update current answer when problem changes
  useEffect(() => {
    setCurrentAnswer(gameState.answers[gameState.currentProblemIndex] || '');
  }, [gameState.currentProblemIndex, gameState.answers]);

  const loadProblems = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await executeLoadProblems();

      if (response?.problems) {
        setProblems(response.problems);
        logger.info(`[loadProblems] Loaded ${response.problems.length} problems for ${difficulty} difficulty`);
      } else {
        throw new Error('無効な問題データです');
      }
    } catch (err) {
      const handledError = ErrorHandler.handleApiError(err, 'loadProblems');
      setError(ErrorHandler.getUserFriendlyMessage(handledError));
      logger.error('[loadProblems] Failed to load problems:', err instanceof Error ? err : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = useCallback(() => {
    setShowCountdown(true);
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    startGame();
    startTimer();
  }, [startGame, startTimer]);

  const handleAnswerChange = useCallback((value: string) => {
    setCurrentAnswer(value);
    setAnswer(gameState.currentProblemIndex, value);
  }, [gameState.currentProblemIndex, setAnswer]);

  // --------------- 完了処理 ---------------
  const handleComplete = useCallback(async () => {
    if (!isComplete) return;

    try {
      setIsSubmitting(true);
      stopTimer();
      const userData = getUserData();
      
      if (!userData) {
        throw new Error('ユーザーデータが見つかりません');
      }

      // Prepare submission data
      const problemResults: ProblemResult[] = problems.map((problem, index) => ({
        problemId: problem.id,
        question: problem.question,
        userAnswer: parseInt(gameState.answers[index] || '0'),
        correctAnswer: problem.answer,
        isCorrect: (gameState.answers[index] || '').toString().trim() === problem.answer.toString().trim(),
        timeSpent: Math.floor(elapsedTime / TOTAL_PROBLEMS) // Rough estimate
      }));

      const results: Results = {
        problems: problemResults,
        results: problemResults,
        totalProblems: TOTAL_PROBLEMS,
        totalQuestions: TOTAL_PROBLEMS,
        correctAnswers: problemResults.filter(p => p.isCorrect).length,
        incorrectAnswers: problemResults.filter(p => !p.isCorrect && p.userAnswer !== 0).length,
        unanswered: problemResults.filter(p => p.userAnswer === 0).length,
        totalTime: elapsedTime,
        timeSpent: Math.floor(elapsedTime / 1000),
        difficulty,
        date: getJSTDateString()
      };

      const submitData: SubmitAnswersRequest = {
        difficulty,
        date: getJSTDateString(),
        problemIds: problems.map(p => p.id),
        answers: gameState.answers.map(answer => answer || ''),
        timeSpentMs: elapsedTime,
        userId: userData._id
      };

      // Submit to API
      const apiResult = await problemsAPI.submitAnswers(submitData);
      
      if (apiResult) {
        // Save completion data
        saveCompletionData(difficulty, userData);
        
        // Clear query cache
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.history] });
        
        logger.info('[handleComplete] Results submitted successfully');
        onComplete(apiResult.results);
      }
    } catch (err) {
      const handledError = ErrorHandler.handleApiError(err, 'handleComplete');
      setError(`結果の送信に失敗しました: ${ErrorHandler.getUserFriendlyMessage(handledError)}`);
      logger.error('[handleComplete] Failed to submit results:', err instanceof Error ? err : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [isComplete, problems, gameState.answers, elapsedTime, difficulty, queryClient, onComplete, stopTimer]);

  // --------------- キー入力処理 ---------------
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !currentAnswer.trim()) return;

    if (gameState.currentProblemIndex < TOTAL_PROBLEMS - 1) {
      nextProblem();
    } else {
      handleComplete();
    }
  }, [currentAnswer, gameState.currentProblemIndex, nextProblem, handleComplete]);

  // --------------- フォーカス処理 ---------------
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
    logger.debug('[handleInputFocus] Input focused, showing adaptive timer positioning');
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    logger.debug('[handleInputBlur] Input blurred, reverting to fixed timer positioning');
  }, []);

  // Loading state - Enhanced with skeleton UI
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Game Progress Skeleton */}
          <SkeletonLoader variant="card" height={120} className="mb-6" />
          
          {/* Problem Display Skeleton */}
          <ProblemSkeleton />
          
          {/* Answer Input Skeleton */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <SkeletonLoader variant="rectangular" height={60} className="mb-4" />
            <div className="flex justify-center space-x-4">
              <SkeletonLoader variant="rectangular" width={100} height={40} />
              <SkeletonLoader variant="rectangular" width={100} height={40} />
            </div>
          </div>
          
          {/* Loading message */}
          <div className="text-center">
            <LoadingSpinner message={`${difficultyToJapanese(difficulty)}レベルの問題を準備中...`} />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorDisplay error={error} onRetry={loadProblems} />
        <div className="text-center mt-4">
          <button onClick={onBack} className="button button-secondary">
            メニューに戻る
          </button>
        </div>
      </div>
    );
  }

  // Countdown state
  if (showCountdown) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <CountdownTimer onCountdownComplete={handleCountdownComplete} />
      </div>
    );
  }

  // Game start screen
  if (!gameState.isStarted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-6" aria-label={`${DIFFICULTY_INFO[difficulty].reading}レベル`}>
            <ruby>
              {DIFFICULTY_INFO[difficulty].title}
              <rt>{DIFFICULTY_INFO[difficulty].reading}</rt>
            </ruby>
            レベル
          </h1>
          <div className="text-lg text-gray-600 mb-8">
            <p className="mb-4"><ruby>計算<rt>けいさん</rt></ruby>問題 {TOTAL_PROBLEMS} 問に<ruby>挑戦<rt>ちょうせん</rt></ruby>します</p>
            <p className="text-sm text-gray-500">
               すべての問題に答えて、あなたの<ruby>計算<rt>けいさん</rt></ruby>スキルを試してみましょう！
            </p>
          </div>
          
          <div className="flex gap-4 justify-center">
            <button onClick={onBack} className="button button-secondary">
              戻る
            </button>
            <button onClick={handleStartGame} className="button button-primary">
              ゲーム開始
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game in progress
  const currentProblem = problems[gameState.currentProblemIndex];
  
  if (!currentProblem) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorDisplay error="問題データの読み込みに失敗しました" onRetry={loadProblems} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto pb-16 sm:pb-8">
        {/* Game Progress */}
        <GameProgress
          currentProblem={gameState.currentProblemIndex}
          totalProblems={TOTAL_PROBLEMS}
          elapsedTime={elapsedTime}
          formatTime={formatTime}
          progress={progress}
        />

        {/* Problem Display */}
        <ProblemDisplay
          problem={currentProblem}
          problemNumber={gameState.currentProblemIndex + 1}
        />

        {/* Answer Input */}
        <AnswerInput
          value={currentAnswer}
          onChange={handleAnswerChange}
          onKeyPress={handleKeyPress}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          inputRef={answerInputRef}
          placeholder="答えを入力してください"
          autoFocus={true}
          key={gameState.currentProblemIndex}
        />

        {/* Game Controls */}
        <GameControls
          currentProblem={gameState.currentProblemIndex}
          totalProblems={TOTAL_PROBLEMS}
          isComplete={isComplete}
          onPrevious={previousProblem}
          onNext={nextProblem}
          onComplete={handleComplete}
          onBack={onBack}
        />

        {/* Submitting state */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 text-center">
              <LoadingSpinner message="結果を送信中..." />
            </div>
          </div>
        )}

        {/* スマホ用適応型タイマー */}
        <MobileTimer
          elapsedTime={elapsedTime}
          formatTime={formatTime}
          isInputFocused={isInputFocused}
          inputRef={answerInputRef}
        />
      </div>
    </div>
  );
};

export default Problems;