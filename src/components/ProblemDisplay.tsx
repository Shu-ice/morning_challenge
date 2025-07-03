import React from 'react';
import type { Problem } from '../types/index';

interface ProblemDisplayProps {
  problem: Problem;
  problemNumber: number;
  className?: string;
}

// 数学問題の読み上げ用ラベル生成関数
const generateMathAriaLabel = (question: string): string => {
  return question
    .replace(/\+/g, 'たす')
    .replace(/\-/g, 'ひく')
    .replace(/\*/g, 'かける')
    .replace(/×/g, 'かける')
    .replace(/\//g, 'わる')
    .replace(/÷/g, 'わる')
    .replace(/=/g, 'は')
    .replace(/\?/g, 'いくつですか')
    .replace(/(\d+)/g, (match) => {
      // 数字を漢数字読みに変換（基本的な例）
      const num = parseInt(match);
      if (num <= 10) {
        const kanjiNumbers = ['ゼロ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう', 'じゅう'];
        return kanjiNumbers[num] || match;
      }
      return match;
    });
};

export const ProblemDisplay: React.FC<ProblemDisplayProps> = React.memo(({
  problem,
  problemNumber,
  className = ""
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-8 mb-6 ${className}`}>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
          <span className="text-xl font-bold text-blue-600">
            {problemNumber}
          </span>
        </div>
        
        <div 
          className="text-3xl font-bold text-gray-800 mb-6 leading-relaxed"
          role="math"
          aria-label={generateMathAriaLabel(problem.question)}
          tabIndex={0}
        >
          {problem.question}
        </div>
        
        {problem.type && (
          <div className="text-sm text-gray-500 bg-gray-100 inline-block px-3 py-1 rounded-full">
            {problem.type}
          </div>
        )}
      </div>
    </div>
  );
});

ProblemDisplay.displayName = 'ProblemDisplay';