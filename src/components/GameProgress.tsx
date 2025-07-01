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
  
  // Color transition based on progress - simulating correct answer rate
  // When 80%+ progress is made, use green gradient (assuming good performance)
  const getProgressGradient = () => {
    if (progressPercentage >= 80) {
      return "from-green-400 to-green-600";
    } else if (progressPercentage >= 60) {
      return "from-blue-400 to-green-500";
    } else if (progressPercentage >= 40) {
      return "from-yellow-400 to-blue-500";
    } else {
      return "from-orange-400 to-yellow-500";
    }
  };

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
      
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100}>
        <div 
          className={`bg-gradient-to-r ${getProgressGradient()} h-3 rounded-full transition-all duration-500 ease-out transform`}
          style={{ 
            width: `${progressPercentage}%`,
            transition: 'width 0.5s ease-out, background 0.3s ease-in-out'
          }}
        />
      </div>
      
      <div className="text-center text-sm text-gray-600 mt-2" aria-label={`完了 ${progress} / ${totalProblems} 問題`}>
        完了: {progress} / {totalProblems} 問題
      </div>
    </div>
  );
};