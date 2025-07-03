import React from 'react';
import ProgressIndicator from './ProgressIndicator';

interface GameProgressProps {
  currentProblem: number;
  totalProblems: number;
  elapsedTime: number;
  formatTime: (seconds: number) => string;
  progress: number;
  className?: string;
}

export const GameProgress: React.FC<GameProgressProps> = React.memo(({
  currentProblem,
  totalProblems,
  elapsedTime,
  formatTime,
  progress,
  className = ""
}) => {
  const progressPercentage = (progress / totalProblems) * 100;

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 mb-6 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="text-lg font-semibold text-gray-700" aria-label={`問題 ${currentProblem + 1} / ${totalProblems}`}>
          問題 {currentProblem + 1} / {totalProblems}
        </div>
        <div className="text-lg font-mono text-blue-600" aria-label={`経過時間 ${formatTime(elapsedTime)}`}>
          経過時間: {formatTime(elapsedTime)}
        </div>
      </div>
      
      <ProgressIndicator
        current={progress}
        total={totalProblems}
        variant="bar"
        size="md"
        showPercentage={false}
        showText={false}
        animated={true}
        color={progressPercentage >= 80 ? 'green' : progressPercentage >= 60 ? 'blue' : progressPercentage >= 40 ? 'orange' : 'red'}
        className="mt-1"
      />
      
      <div className="text-center text-sm text-gray-600 mt-2" aria-label={`完了 ${progress} / ${totalProblems} 問題`}>
        完了: {progress} / {totalProblems} 問題
      </div>
    </div>
  );
});

GameProgress.displayName = 'GameProgress';