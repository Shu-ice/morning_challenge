import React from 'react';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  variant?: 'bar' | 'circle' | 'steps' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showText?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = React.memo(({
  current,
  total,
  variant = 'bar',
  size = 'md',
  showPercentage = true,
  showText = true,
  label,
  className = '',
  animated = true,
  color = 'blue'
}) => {
  const percentage = Math.round((current / total) * 100);
  const isComplete = current >= total;

  const getColorClasses = () => {
    const colors = {
      blue: {
        bg: 'bg-blue-500',
        light: 'bg-blue-100',
        text: 'text-blue-600',
        ring: 'ring-blue-500'
      },
      green: {
        bg: 'bg-green-500',
        light: 'bg-green-100',
        text: 'text-green-600',
        ring: 'ring-green-500'
      },
      orange: {
        bg: 'bg-orange-500',
        light: 'bg-orange-100',
        text: 'text-orange-600',
        ring: 'ring-orange-500'
      },
      red: {
        bg: 'bg-red-500',
        light: 'bg-red-100',
        text: 'text-red-600',
        ring: 'ring-red-500'
      },
      purple: {
        bg: 'bg-purple-500',
        light: 'bg-purple-100',
        text: 'text-purple-600',
        ring: 'ring-purple-500'
      }
    };
    return colors[color];
  };

  const getSizeClasses = () => {
    const sizes = {
      sm: {
        bar: 'h-2',
        circle: 'w-12 h-12',
        text: 'text-xs',
        steps: 'w-6 h-6'
      },
      md: {
        bar: 'h-3',
        circle: 'w-16 h-16',
        text: 'text-sm',
        steps: 'w-8 h-8'
      },
      lg: {
        bar: 'h-4',
        circle: 'w-20 h-20',
        text: 'text-base',
        steps: 'w-10 h-10'
      }
    };
    return sizes[size];
  };

  const colorClasses = getColorClasses();
  const sizeClasses = getSizeClasses();

  // バー型プログレス
  if (variant === 'bar') {
    return (
      <div className={`w-full ${className}`}>
        {(label || showText) && (
          <div className="flex justify-between items-center mb-2">
            {label && (
              <span className={`font-medium ${colorClasses.text} ${sizeClasses.text}`}>
                {label}
              </span>
            )}
            {showText && (
              <span className={`${sizeClasses.text} text-gray-600`}>
                {showPercentage ? `${percentage}%` : `${current}/${total}`}
              </span>
            )}
          </div>
        )}
        
        <div className={`w-full ${colorClasses.light} rounded-full ${sizeClasses.bar} overflow-hidden`}>
          <div
            className={`
              ${colorClasses.bg} ${sizeClasses.bar} rounded-full 
              ${animated ? 'transition-all duration-500 ease-out' : ''}
              ${isComplete ? 'shadow-sm' : ''}
            `}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={label || `進捗: ${current}/${total}`}
          >
            {animated && (
              <div className="h-full w-full bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // サークル型プログレス
  if (variant === 'circle') {
    const circumference = 2 * Math.PI * 20; // radius = 20
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className={`relative ${className}`}>
        <div className={`${sizeClasses.circle} relative`}>
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
            {/* 背景サークル */}
            <circle
              cx="22"
              cy="22"
              r="20"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className={colorClasses.light.replace('bg-', 'text-')}
            />
            {/* プログレスサークル */}
            <circle
              cx="22"
              cy="22"
              r="20"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${colorClasses.bg.replace('bg-', 'text-')} ${
                animated ? 'transition-all duration-500 ease-out' : ''
              }`}
            />
          </svg>
          
          {/* 中央のテキスト */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-semibold ${colorClasses.text} ${sizeClasses.text}`}>
              {showPercentage ? `${percentage}%` : `${current}/${total}`}
            </span>
          </div>
        </div>
        
        {label && (
          <div className="text-center mt-2">
            <span className={`${sizeClasses.text} text-gray-600`}>{label}</span>
          </div>
        )}
      </div>
    );
  }

  // ステップ型プログレス
  if (variant === 'steps') {
    return (
      <div className={`${className}`}>
        {label && (
          <div className="mb-4">
            <span className={`font-medium ${colorClasses.text} ${sizeClasses.text}`}>
              {label}
            </span>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          {Array.from({ length: total }, (_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber <= current;
            const isCurrent = stepNumber === current + 1;
            
            return (
              <React.Fragment key={index}>
                <div
                  className={`
                    ${sizeClasses.steps} rounded-full flex items-center justify-center
                    font-semibold ${sizeClasses.text}
                    ${isCompleted 
                      ? `${colorClasses.bg} text-white` 
                      : isCurrent 
                        ? `${colorClasses.light} ${colorClasses.text} ring-2 ${colorClasses.ring}` 
                        : 'bg-gray-200 text-gray-500'
                    }
                    ${animated ? 'transition-all duration-300' : ''}
                  `}
                  aria-label={`ステップ ${stepNumber}${isCompleted ? ' (完了)' : isCurrent ? ' (現在)' : ''}`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                
                {/* 接続線 */}
                {index < total - 1 && (
                  <div
                    className={`
                      flex-1 h-1 rounded
                      ${stepNumber < current 
                        ? colorClasses.bg 
                        : 'bg-gray-200'
                      }
                      ${animated ? 'transition-all duration-300' : ''}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {showText && (
          <div className="text-center mt-2">
            <span className={`${sizeClasses.text} text-gray-600`}>
              {showPercentage ? `${percentage}%完了` : `${current}/${total}ステップ`}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ミニマル型プログレス
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`flex-1 ${colorClasses.light} rounded-full ${sizeClasses.bar}`}>
          <div
            className={`
              ${colorClasses.bg} ${sizeClasses.bar} rounded-full
              ${animated ? 'transition-all duration-500 ease-out' : ''}
            `}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`${sizeClasses.text} text-gray-600 font-medium whitespace-nowrap`}>
          {showPercentage ? `${percentage}%` : `${current}/${total}`}
        </span>
      </div>
    );
  }

  return null;
});

ProgressIndicator.displayName = 'ProgressIndicator';

export default ProgressIndicator;