import React from 'react';

interface GameControlsProps {
  currentProblem: number;
  totalProblems: number;
  isComplete: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
  onBack: () => void;
  className?: string;
}

export const GameControls: React.FC<GameControlsProps> = ({
  currentProblem,
  totalProblems,
  isComplete,
  onPrevious,
  onNext,
  onComplete,
  onBack,
  className = ""
}) => {
  const isFirstProblem = currentProblem === 0;
  const isLastProblem = currentProblem === totalProblems - 1;

  return (
    <div className={`flex justify-between items-center gap-4 ${className}`}>
      {/* Back to Menu Button */}
      <button
        onClick={onBack}
        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg 
                   hover:bg-gray-50 transition-colors duration-200"
      >
        ← メニューに戻る
      </button>

      {/* Navigation Controls */}
      <div className="flex gap-3">
        {/* Previous Button */}
        <button
          onClick={onPrevious}
          disabled={isFirstProblem}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold
                     hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          ← 前の問題
        </button>

        {/* Next/Complete Button */}
        {isLastProblem ? (
          <button
            onClick={onComplete}
            disabled={!isComplete}
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold text-lg
                       hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 transform hover:scale-105
                       disabled:transform-none"
          >
            {isComplete ? '完了して提出' : '全問題に回答してください'}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold
                       hover:bg-blue-700 transition-all duration-200"
          >
            次の問題 →
          </button>
        )}
      </div>
    </div>
  );
};