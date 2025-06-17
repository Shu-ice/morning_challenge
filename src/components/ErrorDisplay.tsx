import React from 'react';
import { ApplicationError, extractErrorMessage, isNetworkError } from '../types/error';

interface ErrorDisplayProps {
  error: ApplicationError | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showDetails?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  showDetails = false
}) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : extractErrorMessage(error);
  const isNetworkErr = typeof error !== 'string' && isNetworkError(error);
  
  // エラーの種類に応じたアイコンとスタイル
  const getErrorStyle = () => {
    if (isNetworkErr) {
      return {
        icon: '🌐',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        iconColor: 'text-orange-500'
      };
    }
    
    return {
      icon: '⚠️',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-500'
    };
  };

  const style = getErrorStyle();

  return (
    <div className={`
      ${style.bgColor} ${style.borderColor} ${style.textColor}
      border rounded-lg p-4 mb-4 ${className}
    `}>
      <div className="flex items-start space-x-3">
        <div className={`${style.iconColor} text-xl`}>
          {style.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium mb-1">
            {isNetworkErr ? 'ネットワークエラー' : 'エラーが発生しました'}
          </h3>
          
          <p className="text-sm">
            {errorMessage}
          </p>
          
          {showDetails && typeof error === 'object' && 'code' in error && (
            <p className="text-xs mt-2 opacity-75">
              エラーコード: {error.code}
            </p>
          )}
          
          {/* ネットワークエラーの場合はヒントを表示 */}
          {isNetworkErr && (
            <p className="text-xs mt-2 opacity-75">
              💡 ヒント: サーバーが起動しているか確認してください
            </p>
          )}
        </div>
        
        <div className="flex flex-col space-y-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="
                bg-white border border-gray-300 text-gray-700
                px-3 py-1 rounded text-xs font-medium
                hover:bg-gray-50 transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
            >
              再試行
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`
                ${style.textColor} hover:opacity-75
                text-lg leading-none
                focus:outline-none
              `}
              aria-label="エラーを閉じる"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay; 