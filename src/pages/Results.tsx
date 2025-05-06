import React, { useState, useEffect, useRef } from 'react';
import '../styles/Results.css';
import type { PracticeSession, ProblemResult } from '@/types/index';
import { difficultyToJapanese } from '@/types/difficulty';

interface ResultsProps {
  results: PracticeSession | null;
  onViewRankings: () => void;
  onBackToHome: () => void;
}

const Results: React.FC<ResultsProps> = ({ results, onViewRankings, onBackToHome }) => {
  const [showConfetti, setShowConfetti] = useState(true);
  
  useEffect(() => {
    if (!results) return;
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);
    console.log('結果データ (PracticeSession):', results);
    return () => clearTimeout(timer);
  }, [results]);
  
  if (!results) {
    return (
      <div className="results-container p-8">
        <div className="results-header text-center mb-8">
          <h1>結果が見つかりません</h1>
          <p>問題を解いてから結果を確認してください。</p>
          <button 
            onClick={onBackToHome}
            className="button button-primary mt-4"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }
  
  const correctAnswers = results.results.filter(r => r.isCorrect).length;
  const totalProblems = results.results.length;
  const timeSpent = results.endTime && results.startTime ? (new Date(results.endTime).getTime() - new Date(results.startTime).getTime()) : 0;
  const score = results.score !== undefined ? results.score : 0;
  const problems = results.results;
  const difficulty = results.difficulty;
  const rank = null;
  
  const formatTime = (milliseconds: number) => {
    const totalSeconds = milliseconds / 1000;
    return `${totalSeconds.toFixed(2)}秒`; 
  };

  const getResultMessage = () => {
    if (totalProblems === 0) return "";
    const accuracy = (correctAnswers / totalProblems) * 100;
    if (accuracy === 100) return "素晴らしい！全問正解です！";
    if (accuracy >= 80) return "よくできました！";
    if (accuracy >= 60) return "まずまずの成績です！";
    return "もう少し頑張りましょう！";
  };

  const handleViewRankingsClick = () => {
    if (results) {
      localStorage.setItem('selectedDifficultyFromResults', results.difficulty);
    }
    onViewRankings();
  };

  return (
    <div className="results-container p-4 md:p-8 max-w-3xl mx-auto">
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(100)].map((_, i) => (
            <div key={i} className="confetti"></div>
          ))}
        </div>
      )}

      <div className="results-header text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">結果発表</h1>
        <p className="text-lg md:text-xl text-gray-600">{getResultMessage()}</p>
      </div>

      <div className="results-summary bg-white rounded-lg shadow-lg p-6 mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-sm text-gray-500">難易度</div>
          <div className="text-xl font-semibold">{difficultyToJapanese(difficulty)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">正解数</div>
          <div className="text-xl font-semibold">{correctAnswers} / {totalProblems}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">かかった時間</div>
          <div className="text-xl font-semibold">{formatTime(timeSpent)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">あなたの順位</div>
          <div className="text-xl font-semibold">{rank ? `${rank}位` : '-'}</div>
        </div>
      </div>

      <div className="results-details bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">詳細</h2>
        <ul className="space-y-4">
          {problems && problems.length > 0 ? (
            problems.map((problem, index) => (
              <li key={index} className={`p-4 rounded-lg ${problem.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">問題 {index + 1}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${problem.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {problem.isCorrect ? '正解' : '不正解'}
                    </span>
                  </div>
                  <div className="text-gray-700">
                    <p className="font-medium">問題:</p>
                    <p className="ml-4">{problem.question}</p>
                  </div>
                  <div className="text-gray-700">
                    <p className="font-medium">あなたの答え:</p>
                    <p className={`ml-4 ${problem.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {problem.userAnswer !== null ? problem.userAnswer : '未解答'}
                    </p>
                  </div>
                  {!problem.isCorrect && (
                    <div className="text-gray-700">
                      <p className="font-medium">正解:</p>
                      <p className="ml-4 text-green-600">{problem.correctAnswer}</p>
                    </div>
                  )}
              </div>
            </li>
            ))
          ) : (
            <li className="p-4 text-center text-gray-500">詳細データがありません</li>
          )}
        </ul>
      </div>

      <div className="results-actions text-center space-x-4">
        <button 
          onClick={onBackToHome} 
          className="button button-secondary"
        >
          ホームに戻る
        </button>
        <button 
          onClick={handleViewRankingsClick}
          className="button button-primary"
        >
          ランキングを見る
        </button>
      </div>
    </div>
  );
};

export default Results;