import React from 'react';
import { usePreciseCountdown } from '../hooks/usePreciseCountdown';

interface CountdownTimerProps {
  onCountdownComplete: () => void;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ 
  onCountdownComplete,
  className = ""
}) => {
  const { count, startCountdown } = usePreciseCountdown(1000, onCountdownComplete);

  React.useEffect(() => {
    startCountdown(3);
  }, [startCountdown]);

  if (count === 0) {
    return (
      <div className={`text-center ${className}`}>
        <div className="text-6xl font-bold text-green-600 animate-pulse">
          START!
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      <div className="text-8xl font-bold text-blue-600 animate-bounce">
        {count !== null ? count : 3}
      </div>
      <div className="text-xl text-gray-600 mt-4">
        ゲーム開始まで...
      </div>
    </div>
  );
};