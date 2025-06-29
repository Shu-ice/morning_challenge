import React from 'react';

interface GameProgressProps {
  currentProblem: number;
  totalProblems: number;
  elapsedTime: number;
  formatTime: (seconds: number) => string;
  progress: number;
  className?: string;
}

export const GameProgress: React.FC<GameProgressProps> = ({
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
        <div className="text-lg font-semibold text-gray-700">
          問題 {currentProblem + 1} / {totalProblems}
        </div>
        <div className="text-lg font-mono text-blue-600">
          経過時間: {formatTime(elapsedTime)}
        </div>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      <div className="text-center text-sm text-gray-600 mt-2">
        完了: {progress} / {totalProblems} 問題
      </div>
    </div>
  );
};