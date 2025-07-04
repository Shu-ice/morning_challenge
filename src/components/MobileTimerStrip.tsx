import React from 'react';

interface MobileTimerStripProps {
  elapsedTime: number;
  formatTime: (seconds: number) => string;
  className?: string;
}

export const MobileTimerStrip: React.FC<MobileTimerStripProps> = React.memo(({
  elapsedTime,
  formatTime,
  className = ""
}) => {
  const formattedTime = formatTime(elapsedTime);
  
  return (
    <>
      {/* スマホ用タイマー帯 - ボタンの下に固定表示 */}
      <div 
        className={`
          mobile-timer-strip
          w-full mt-4 mb-4
          bg-gradient-to-r from-gray-50 to-gray-100
          border border-gray-200 rounded-lg
          px-4 py-3
          shadow-sm
          sm:hidden
          ${className}
        `}
        role="timer"
        aria-live="polite"
        aria-label={`経過時間 ${formattedTime}`}
        aria-atomic="true"
      >
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" 
              aria-hidden="true"
              role="presentation"
            />
            <span 
              className="font-mono text-sm font-semibold text-gray-700 tracking-wide select-none"
              id="mobile-timer-strip-display"
            >
              ⏰ 経過時間: {formattedTime}
            </span>
            <div 
              className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" 
              aria-hidden="true"
              role="presentation"
            />
          </div>
        </div>
        
        {/* スクリーンリーダー用の説明 */}
        <div 
          id="mobile-timer-strip-label" 
          className="sr-only"
        >
          計算問題の経過時間を表示しています。操作ボタンの下に常時表示されており、問題解答中でも時間を確認できます。
        </div>
      </div>
    </>
  );
});

MobileTimerStrip.displayName = 'MobileTimerStrip';