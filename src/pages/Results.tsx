import React, { useState, useEffect } from 'react';
import '../styles/Results.css';
import type { Results as ResultsType, ProblemResult } from '@/types';
import { difficultyToJapanese } from '@/types/difficulty';
import { useNavigate } from 'react-router-dom';

interface ResultsProps {
  results: ResultsType | null;
  onViewRankings: () => void;
}

const Results: React.FC<ResultsProps> = ({ results, onViewRankings }) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!results) return;
    
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [results]);
  
  if (!results) {
    return (
      <div className="results-container p-8">
        <div className="results-header text-center mb-8">
          <h1>結果が見つかりません</h1>
          <p>問題を解いてから結果を確認してください。</p>
        </div>
      </div>
    );
  }
  
  const formatTime = (milliseconds: number) => {
    const totalSeconds = milliseconds / 1000;
    return `${totalSeconds.toFixed(2)}秒`;
  };
  
  const getScoreMessage = (correctAnswers: number, totalProblems: number) => {
    if (totalProblems === 0) return '問題がありません';
    const percentage = (correctAnswers / totalProblems) * 100;
    if (percentage === 100) return '完璧！🎉';
    if (percentage >= 90) return '素晴らしい！✨';
    if (percentage >= 70) return '良くできました！👍';
    if (percentage >= 50) return 'がんばりました！😊';
    return 'また明日挑戦しよう！💪';
  };
  
  const getProgressBarWidth = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
  };
  
  // ランキングを表示する時に自分の難易度を指定して遷移
  const handleViewRankings = () => {
    if (results) {
      // 難易度パラメータをローカルストレージに保存
      localStorage.setItem('selectedDifficultyFromResults', results.difficulty);
      navigate('/rankings');
    } else {
      onViewRankings();
    }
  };
  
  const correctAnswers = results.correctAnswers;
  const totalProblems = results.totalProblems;
  const incorrectAnswers = totalProblems - correctAnswers;
  
  return (
    <div className="results-container max-w-3xl mx-auto p-4 md:p-8">
      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 50 }).map((_, index) => (
            <div 
              key={index}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                backgroundColor: `hsl(${Math.random() * 360}, 80%, 60%)`
              }}
            />
          ))}
        </div>
      )}
      
      <div className="results-header text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">チャレンジ結果</h1>
        <p className="text-lg text-gray-600">{difficultyToJapanese(results.difficulty)} レベル</p>
      </div>
      
      <div className="results-card bg-white rounded-lg shadow-lg p-6 md:p-8">
        <div className="score-section text-center mb-8">
          <p className="score-message text-2xl font-semibold mb-4">{getScoreMessage(correctAnswers, totalProblems)}</p>
        </div>
        
        <div className="stats-section space-y-4 mb-8">
          <div className="stat-item">
            <div className="flex justify-between mb-1">
              <span className="stat-label font-medium">正解</span>
              <span className="stat-value text-green-600 font-medium">{correctAnswers}/{totalProblems}</span>
            </div>
            <div className="stat-bar bg-gray-200 rounded-full h-2.5">
              <div 
                className="stat-progress correct bg-green-500 h-2.5 rounded-full"
                style={{ width: getProgressBarWidth(correctAnswers, totalProblems) }}
              />
            </div>
          </div>
          
          <div className="stat-item">
            <div className="flex justify-between mb-1">
              <span className="stat-label font-medium">不正解</span>
              <span className="stat-value text-red-600 font-medium">{incorrectAnswers}/{totalProblems}</span>
            </div>
            <div className="stat-bar bg-gray-200 rounded-full h-2.5">
              <div 
                className="stat-progress incorrect bg-red-500 h-2.5 rounded-full"
                style={{ width: getProgressBarWidth(incorrectAnswers, totalProblems) }}
              />
            </div>
          </div>
          
          <div className="stat-item time flex justify-between items-center pt-4">
            <span className="stat-label text-lg font-medium">所要時間</span>
            <span className="stat-value time-value text-xl font-semibold text-primary-600">{formatTime(results.timeSpent * 1000)}</span>
          </div>
        </div>

        {/* 問題詳細テーブルを追加 */}
        <div className="problem-details-section mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-center">問題ごとの結果</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">問題</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">あなたの回答</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">正解</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">結果</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(results.problems as ProblemResult[]).map((problem: ProblemResult, index: number) => (
                  <tr key={problem.id} className={problem.isCorrect ? '' : 'bg-red-50'}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{problem.question}</td>
                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${problem.isCorrect ? 'text-gray-700' : 'text-red-600'}`}>
                      {problem.userAnswer ?? '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{problem.correctAnswer}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      {problem.isCorrect ? (
                        <span className="text-green-500 text-lg">○</span>
                      ) : (
                        <span className="text-red-500 text-lg">×</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* 問題詳細テーブルここまで */}

        <div className="results-actions flex justify-center gap-4 mt-8">
          <button 
            className="button button-primary"
            onClick={handleViewRankings}
          >
            ランキングを見る
          </button>
        </div>
      </div>
      
      <div className="results-footer text-center mt-8">
        <p className="text-gray-600">次回のチャレンジは明日の朝6:30からです。お楽しみに！</p>
      </div>
    </div>
  );
};

export default Results;