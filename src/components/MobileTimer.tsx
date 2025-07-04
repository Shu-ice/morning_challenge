import React, { useEffect, useState } from 'react';

interface MobileTimerProps {
  elapsedTime: number;
  formatTime: (seconds: number) => string;
  className?: string;
  isInputFocused?: boolean;
  inputRef?: React.RefObject<HTMLElement>;
}

export const MobileTimer: React.FC<MobileTimerProps> = React.memo(({
  elapsedTime,
  formatTime,
  className = "",
  isInputFocused = false,
  inputRef
}) => {
  const formattedTime = formatTime(elapsedTime);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  
  // ビューポート変更を監視（キーボード表示/非表示検出）
  useEffect(() => {
    const handleViewportChange = () => {
      const newHeight = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(newHeight);
    };
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
      };
    }
  }, []);
  
  // 入力フォーカス時の位置計算
  const getPositionStyle = (): React.CSSProperties => {
    if (!isInputFocused || !inputRef?.current) {
      // 通常時: 画面下部固定
      return {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        minHeight: '56px',
        transform: 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      };
    }
    
    // フォーカス時: 入力欄の近くに表示
    try {
      const inputRect = inputRef.current.getBoundingClientRect();
      const inputBottom = inputRect.bottom;
      const inputTop = inputRect.top;
      const windowHeight = window.innerHeight;
      const viewportCenter = windowHeight * 0.5;
      
      // キーボードの高さを推定（iOS Safari対応）
      const keyboardHeight = Math.max(0, windowHeight - viewportHeight);
      const availableHeight = viewportHeight;
      
      // 入力欄が画面の下半分にある場合は、入力欄の上に表示
      if (inputTop > viewportCenter || inputBottom > availableHeight - 60) {
        const spaceAboveInput = Math.max(16, inputTop - 60); // 入力欄の上のスペース
        return {
          position: 'fixed',
          top: `${spaceAboveInput}px`,
          left: 0,
          right: 0,
          paddingBottom: '12px',
          minHeight: '48px',
          transform: 'translateY(0)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 45 // 入力欄より上に表示
        };
      }
      
      // 入力欄の下に表示できる場合
      const spaceBelowInput = availableHeight - inputBottom - 16;
      if (spaceBelowInput >= 48) {
        return {
          position: 'fixed',
          top: `${inputBottom + 8}px`,
          left: 0,
          right: 0,
          paddingBottom: '12px',
          minHeight: '48px',
          transform: 'translateY(0)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        };
      }
      
      // スペースが限られている場合は、可視範囲の上部に表示
      return {
        position: 'fixed',
        top: '16px',
        left: 0,
        right: 0,
        paddingBottom: '12px',
        minHeight: '48px',
        transform: 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 45
      };
    } catch (error) {
      // エラー時は安全にフォールバック
      return {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        minHeight: '56px',
        transform: 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      };
    }
  };
  
  return (
    <>
      {/* スマホ用適応型タイマー */}
      <div 
        className={`
          z-40
          bg-gradient-to-r from-blue-600 to-blue-700 text-white
          px-4 py-2
          shadow-2xl border border-blue-800
          backdrop-blur-sm
          sm:hidden
          rounded-lg
          ${isInputFocused ? 'mx-2' : 'mx-0 border-t-2 border-l-0 border-r-0 border-b-0 rounded-none'}
          ${className}
        `}
        role="timer"
        aria-live="polite"
        aria-label={`計算問題の経過時間 ${formattedTime}`}
        aria-atomic="true"
        tabIndex={-1}
        style={getPositionStyle()}
      >
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-3">
            <div 
              className="w-2 h-2 bg-white rounded-full animate-pulse" 
              aria-hidden="true"
              role="presentation"
            />
            <span 
              className={`font-mono font-bold tracking-wide select-none transition-all duration-200 ${
                isInputFocused ? 'text-base' : 'text-lg'
              }`}
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
          {isInputFocused && 'タイマーは入力欄の近くに移動しました。'}
        </div>
      </div>
    </>
  );
});

MobileTimer.displayName = 'MobileTimer';