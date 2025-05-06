import React, { useState, useEffect, useRef } from 'react';
import '../styles/Results.css';
import type { Results as ResultsType, ProblemResult } from '@/types/index';
import { difficultyToJapanese } from '@/types/difficulty';

interface ResultsProps {
  results: ResultsType | null;
  onViewRankings: () => void;
  onBackToHome: () => void;
}

const Results: React.FC<ResultsProps> = ({ results, onViewRankings, onBackToHome }) => {
  const [showConfetti, setShowConfetti] = useState(true);
  
  useEffect(() => {
    // 結果がない場合は何もしない
    if (!results) return;
    
    // 紙吹雪エフェクトのタイマー設定
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);
    
    // APIのレスポンスの問題を表示
    console.log('結果データ:', results);
    
    // クリーンアップ関数
    return () => clearTimeout(timer);
  }, [results]); // 依存配列から hasSavedResult を削除
  
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
  
  const formatTime = (milliseconds: number) => {
    const totalSeconds = milliseconds / 1000;
    // ここで表示用にフォーマット (例: 小数点以下2桁)
    return `${totalSeconds.toFixed(2)}秒`; 
  };

  const getResultMessage = () => {
    if (!results) return "";
    const accuracy = (results.correctAnswers / results.totalProblems) * 100;
    if (accuracy === 100) return "素晴らしい！全問正解です！";
    if (accuracy >= 80) return "よくできました！";
    if (accuracy >= 60) return "まずまずの成績です！";
    return "もう少し頑張りましょう！";
  };

  // ★ クリックハンドラを修正
  const handleViewRankingsClick = () => {
    if (results) {
      // ★ localStorage に難易度を保存
      localStorage.setItem('selectedDifficultyFromResults', results.difficulty);
    }
    // App.tsx から渡された onViewRankings を実行
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
          <div className="text-xl font-semibold">{difficultyToJapanese(results.difficulty)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">正解数</div>
          <div className="text-xl font-semibold">{results.correctAnswers} / {results.totalProblems}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">かかった時間</div>
          <div className="text-xl font-semibold">{formatTime(results.totalTime)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">あなたの順位</div>
          {/* rank が 0 または null/undefined の場合は "-" を表示 */} 
          <div className="text-xl font-semibold">{results.rank ? `${results.rank}位` : '-'}</div>
        </div>
      </div>

      <div className="results-details bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">詳細</h2>
        <ul className="space-y-2">
          {results.problems && results.problems.length > 0 ? (
            results.problems.map((problem, index) => (
            <li key={index} className={`flex justify-between items-center p-2 rounded ${problem.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="text-sm md:text-base">問題 {index + 1}: {problem.question.replace(' = ?', '')}</span>
              <div className="text-right">
                <span className={`font-medium ${problem.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {problem.userAnswer !== null ? problem.userAnswer : '未解答'}
                  {!problem.isCorrect && (
                    <span className="text-xs text-gray-500 ml-2">
                      (正解: {problem.correctAnswer})
                    </span>
                  )}
                </span>
              </div>
            </li>
            ))
          ) : (
            <li className="p-2 text-center text-gray-500">詳細データがありません</li>
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