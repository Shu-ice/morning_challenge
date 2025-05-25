import React, { useState, useEffect, useRef } from 'react';
import '../styles/Results.css';
// import type { PracticeSession, ProblemResult } from '@/types/index'; // ★ PracticeSession は使わない
import type { ProblemResult } from '@/types/index'; // ProblemResult は流用
import { difficultyToJapanese, DifficultyRank } from '@/types/difficulty'; // ★ DifficultyRank もインポート

// ★ サーバーの resultsData に合わせた型定義
interface ApiResultData {
  totalProblems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalTime: number; // ★ APIレスポンスの totalTime (ミリ秒単位) を使用
  // timeSpent: number; // 秒単位のものは不要であれば削除、または型を修正
  results: ProblemResult[];
  score: number;
  difficulty: DifficultyRank;
  date: string;
  startTime?: number;
  endTime?: number;
  rank?: number;
}

interface ResultsProps {
  results: ApiResultData | null; // ★ 型を変更
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
    console.log('結果データ (ApiResultData):', results); // ★ 型名変更
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
  
  // results オブジェクトから直接値を取得 (apiResults 中間変数は不要に)
  console.log('[Results.tsx] Received results prop:', JSON.stringify(results, null, 2)); // ★ デバッグログ追加
  const correctAnswers = results.results.filter(p => p.isCorrect).length; // ★ problems から results に変更
  const totalProblems = results.results.length; // ★ problems から results に変更
  
  // ★ APIレスポンスの results.totalTime (ミリ秒単位) を直接使用する
  const timeSpentInMilliseconds = results.totalTime !== undefined ? results.totalTime : 0;

  const score = results.score !== undefined ? results.score : 0;
  const problems = results.results; // ★ problems から results に変更 (実質的な問題配列への参照)
  const difficulty = results.difficulty;
  const rank = results.rank; // rankもAPIから取得
  
  // 時間をフォーマットする関数 (ミリ秒 -> 0.01秒単位) - UserHistory.tsx と同様の実装
  const formatTime = (milliseconds: number | undefined): string => {
    if (milliseconds === undefined || milliseconds === null || isNaN(milliseconds)) return '-';
    try {
      const seconds = milliseconds / 1000;
      return `${seconds.toFixed(2)}秒`;
    } catch (e) {
      console.error('時間フォーマットエラー:', e);
      return `${milliseconds} ms`; // エラー時はミリ秒をそのまま表示
    }
  };

  const getResultMessage = () => {
    if (totalProblems === 0) return "";
    const accuracy = (correctAnswers / totalProblems) * 100;
    if (accuracy === 100) return "すばらしい！<ruby>全問<rt>ぜんもん</rt></ruby><ruby>正解<rt>せいかい</rt></ruby>です！";
    if (accuracy >= 80) return "よくできました！";
    if (accuracy >= 60) return "まずまずの<ruby>成績<rt>せいせき</rt></ruby>です！";
    return "もう<ruby>少<rt>すこ</rt></ruby>し<ruby>頑張<rt>がんば</rt></ruby>りましょう！";
  };

  const handleViewRankingsClick = () => {
    if (results && results.difficulty) {
      // ランキングページで表示する難易度を確実にlocalStorageに保存
      localStorage.setItem('selectedDifficultyFromResults', results.difficulty);
      console.log(`[Results] Saving difficulty to localStorage: ${results.difficulty}`);
    }
    onViewRankings();
  };

  return (
    <div className="results-container card p-4 md:p-8 max-w-3xl mx-auto">
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(100)].map((_, i) => (
            <div key={i} className="confetti"></div>
          ))}
        </div>
      )}

      <div className="results-header text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">🎉 <ruby>結果<rt>けっか</rt></ruby><ruby>発表<rt>はっぴょう</rt></ruby></h1>
        <p className="text-lg md:text-xl text-gray-600" dangerouslySetInnerHTML={{ __html: getResultMessage() }}></p>
      </div>

      <div className="results-summary bg-white rounded-lg shadow-lg p-6 mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-sm text-gray-500"><ruby>難易度<rt>なんいど</rt></ruby></div>
          <div className="text-xl font-semibold">{difficultyToJapanese(difficulty)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500"><ruby>正解数<rt>せいかいすう</rt></ruby></div>
          <div className="text-xl font-semibold">{correctAnswers} / {totalProblems}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">かかった<ruby>時間<rt>じかん</rt></ruby></div>
          <div className="text-xl font-semibold">{formatTime(timeSpentInMilliseconds)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">あなたの<ruby>順位<rt>じゅんい</rt></ruby></div>
          <div className="text-xl font-semibold">{rank ? `${rank}位` : '-'}</div>
        </div>
      </div>

      <div className="results-details bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">📊 <ruby>詳細<rt>しょうさい</rt></ruby></h2>
        <ul className="space-y-4">
          {problems && problems.length > 0 ? (
            problems.map((problem, index) => (
              <li key={index} className={`p-4 rounded-lg ${problem.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium"><ruby>問題<rt>もんだい</rt></ruby> {index + 1}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${problem.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {problem.isCorrect ? (
                        <span><ruby>正解<rt>せいかい</rt></ruby></span>
                      ) : (
                        <span><ruby>不正解<rt>ふせいかい</rt></ruby></span>
                      )}
                    </span>
                  </div>
                  <div className="text-gray-700">
                    <p className="font-medium"><ruby>問題<rt>もんだい</rt></ruby>:</p>
                    <p className="ml-4">{problem.question}</p>
                  </div>
                  <div className="text-gray-700">
                    <p className="font-medium">あなたの<ruby>答<rt>こた</rt></ruby>え:</p>
                    <p className={`ml-4 ${problem.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {problem.userAnswer !== null ? (
                        problem.userAnswer
                      ) : (
                        <ruby>未解答<rt>みかいとう</rt></ruby>
                      )}
                    </p>
                  </div>
                  {!problem.isCorrect && (
                    <div className="text-gray-700">
                      <p className="font-medium"><ruby>正解<rt>せいかい</rt></ruby>:</p>
                      <p className="ml-4 text-green-600">{problem.correctAnswer}</p>
                    </div>
                  )}
              </div>
            </li>
            ))
          ) : (
            <li className="p-4 text-center text-gray-500"><ruby>詳細<rt>しょうさい</rt></ruby>データがありません</li>
          )}
        </ul>
      </div>

      <div className="results-actions text-center space-x-4">
        <button 
          onClick={onBackToHome} 
          className="button button-secondary"
        >
          ホームにもどる
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