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

  // Handle numeric input only
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits
    if (/^\d*$/.test(value)) {
      onChange(value);
    }
  };

  // Prevent non-numeric keys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrow keys
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
    ];
    
    // Allow numeric keys (0-9) and numpad keys
    const isNumeric = (e.key >= '0' && e.key <= '9') || 
                     (e.code >= 'Numpad0' && e.code <= 'Numpad9');
    
    if (!allowedKeys.includes(e.key) && !isNumeric) {
      e.preventDefault();
    }
  };


  return (
    <div className={`mb-6 ${className}`} data-form-type="math-calculation">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          name="mathQuestionAnswer"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyPress={onKeyPress}
          placeholder={placeholder}
          className="w-full px-6 py-4 text-2xl text-center border-2 border-gray-300 rounded-xl 
                     focus:border-blue-500 focus:ring-4 focus:ring-blue-200 
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400
                     transition-all duration-200 ease-in-out
                     placeholder-gray-400 font-mono"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="textbox"
          aria-label="答えを入力"
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