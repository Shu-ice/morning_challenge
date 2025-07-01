import React from 'react';
import type { Problem } from '../types/index';

interface ProblemDisplayProps {
  problem: Problem;
  problemNumber: number;
  className?: string;
}

export const ProblemDisplay: React.FC<ProblemDisplayProps> = ({
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
        
        <div className="text-3xl font-bold text-gray-800 mb-6 leading-relaxed">
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
};