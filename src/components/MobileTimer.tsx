import React from 'react';

interface MobileTimerProps {
  elapsedTime: number;
  formatTime: (seconds: number) => string;
  className?: string;
}

export const MobileTimer: React.FC<MobileTimerProps> = React.memo(({
  elapsedTime,
  formatTime,
  className = ""
}) => {
  const formattedTime = formatTime(elapsedTime);
  
  return (
    <>
      {/* スマホ用固定タイマー - キーボードの上に表示 */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 z-40
          bg-gradient-to-r from-blue-600 to-blue-700 text-white
          px-4 py-3
          shadow-2xl border-t-2 border-blue-800
          backdrop-blur-sm
          sm:hidden
          ${className}
        `}
        role="timer"
        aria-live="polite"
        aria-label={`計算問題の経過時間 ${formattedTime}`}
        aria-atomic="true"
        tabIndex={-1}
        style={{ 
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          minHeight: '56px' 
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-3">
            <div 
              className="w-2 h-2 bg-white rounded-full animate-pulse" 
              aria-hidden="true"
              role="presentation"
            />
            <span 
              className="font-mono text-lg font-bold tracking-wide select-none"
              id="mobile-timer-display"
            >
              経過時間: {formattedTime}
            </span>
            <div 
              className="w-2 h-2 bg-white rounded-full animate-pulse" 
              aria-hidden="true"
              role="presentation"
            />
          </div>
        </div>
        
        {/* スクリーンリーダー用の説明 */}
        <div 
          id="mobile-timer-label" 
          className="sr-only"
        >
          計算問題の解答時間を表示しています。時間は自動的に更新されます。
        </div>
      </div>
    </>
  );
});

MobileTimer.displayName = 'MobileTimer';