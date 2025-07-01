import React, { useState, useEffect } from 'react';

interface DarkModeToggleProps {
  className?: string;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ className = '' }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const shouldUseDarkMode = savedTheme ? savedTheme === 'dark' : prefersDark;
    setIsDarkMode(shouldUseDarkMode);
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', shouldUseDarkMode ? 'dark' : 'light');
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // Save preference
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', newDarkMode ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleDarkMode}
      className={`
        relative inline-flex items-center justify-center w-12 h-6 
        bg-gray-200 rounded-full transition-colors duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400
        dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600
        ${className}
      `}
      role="switch"
      aria-checked={isDarkMode}
      aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
      type="button"
    >
      {/* Toggle knob */}
      <span
        className={`
          inline-block w-4 h-4 bg-white rounded-full shadow-sm
          transition-transform duration-200 ease-in-out
          ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
      
      {/* Icons */}
      <span 
        className={`
          absolute left-1 top-1 w-4 h-4 flex items-center justify-center
          transition-opacity duration-200
          ${isDarkMode ? 'opacity-0' : 'opacity-100'}
        `}
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="5" fill="#FCD34D"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
      
      <span 
        className={`
          absolute right-1 top-1 w-4 h-4 flex items-center justify-center
          transition-opacity duration-200
          ${isDarkMode ? 'opacity-100' : 'opacity-0'}
        `}
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#60A5FA"/>
        </svg>
      </span>
    </button>
  );
};

export default DarkModeToggle;