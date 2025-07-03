import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
  retryCount?: number;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({
  size = 'md',
  message,
  fullScreen = false,
  retryCount = 0,
  className = ''
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-12 h-12';
      default:
        return 'w-8 h-8';
    }
  };

  const getContainerClasses = () => {
    if (fullScreen) {
      return `
        fixed inset-0 bg-white bg-opacity-80 
        flex items-center justify-center z-50
      `;
    }
    return 'flex items-center justify-center p-4';
  };

  const spinner = (
    <div className={`${getSizeClasses()} relative`}>
      {/* メインスピナー */}
      <div 
        className={`
          ${getSizeClasses()} 
          border-4 border-gray-200 border-t-blue-600 
          rounded-full animate-spin
          motion-reduce:animate-pulse motion-reduce:border-solid
        `}
        role="status"
        aria-label="読み込み中"
      ></div>
      
      {/* リトライ中の場合は追加のインジケーター */}
      {retryCount > 0 && (
        <div 
          className={`
            absolute inset-0 ${getSizeClasses()}
            border-2 border-orange-300 border-r-orange-600
            rounded-full animate-pulse
            motion-reduce:animate-none motion-reduce:opacity-75
          `}
          role="status"
          aria-label="再試行中"
        ></div>
      )}
    </div>
  );

  return (
    <div className={`${getContainerClasses()} ${className}`}>
      <div className="text-center">
        {spinner}
        
        {message && (
          <p className="mt-3 text-sm text-gray-600">
            {message}
          </p>
        )}
        
        {retryCount > 0 && (
          <p className="mt-2 text-xs text-orange-600">
            再試行中... ({retryCount}回目)
          </p>
        )}
      </div>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

// インライン使用用の小さなスピナー
export const InlineSpinner: React.FC<{ className?: string }> = ({ 
  className = '' 
}) => (
  <div className={`inline-block w-4 h-4 ${className}`}>
    <div 
      className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin motion-reduce:animate-pulse motion-reduce:border-solid" 
      role="status"
      aria-label="読み込み中"
    ></div>
  </div>
);

// ボタン内使用用のスピナー
export const ButtonSpinner: React.FC<{ className?: string }> = ({ 
  className = '' 
}) => (
  <div className={`inline-block w-4 h-4 mr-2 ${className}`}>
    <div 
      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse motion-reduce:border-solid" 
      role="status"
      aria-label="読み込み中"
    ></div>
  </div>
);

export default LoadingSpinner; 