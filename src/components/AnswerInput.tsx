import React, { useEffect, useRef } from 'react';

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const AnswerInput: React.FC<AnswerInputProps> = ({
  value,
  onChange,
  onKeyPress,
  placeholder = "答えを入力してください",
  autoFocus = true,
  className = ""
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure proper focus
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <div className={`mb-6 ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={placeholder}
          className="w-full px-6 py-4 text-2xl text-center border-2 border-gray-300 rounded-xl 
                     focus:border-blue-500 focus:ring-4 focus:ring-blue-200 
                     transition-all duration-200 ease-in-out
                     placeholder-gray-400 font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        
        {value && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>
      
      <div className="text-center text-sm text-gray-500 mt-2">
        Enterキーで次の問題へ進みます
      </div>
    </div>
  );
};