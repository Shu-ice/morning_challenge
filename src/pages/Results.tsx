import React, { useState, useEffect, useRef } from 'react';
import '../styles/Results.css';
import type { ApiResult } from '@/types/index';
import { difficultyToJapanese } from '@/types/difficulty';
import { formatTime } from '../utils/dateUtils';
import { historyAPI } from '../api/index';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

interface ResultsProps {
  results: ApiResult | null;
  onViewRankings: () => void;
  onBackToHome: () => void;
}

interface HistoryItem {
  date: string;
  difficulty: string;
  correctAnswers: number;
  totalProblems: number;
  score: number;
  timeSpent: number;
  rank?: number;
}

interface DayResult {
  date: string;
  dateDisplay: string;
  hasResult: boolean;
  result?: HistoryItem;
}

const Results: React.FC<ResultsProps> = ({ results, onViewRankings, onBackToHome }) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [sevenDayHistory, setSevenDayHistory] = useState<DayResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 過去7日分の日付配列を生成する関数
  const generateLast7Days = (): DayResult[] => {
    const days: DayResult[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const dateDisplay = `${date.getMonth() + 1}/${date.getDate()}`; // M/D
      
      days.push({
        date: dateString,
        dateDisplay,
        hasResult: false,
        result: undefined
      });
    }
    
    return days;
  };

  // 履歴データを7日分のグリッドにマッピングする関数
  const mapHistoryTo7Days = (history: HistoryItem[]): DayResult[] => {
    const sevenDays = generateLast7Days();
    
    // 履歴データを日付をキーとしたマップに変換
    const historyMap = new Map<string, HistoryItem>();
    history.forEach(item => {
      // 日付文字列の正規化（YYYY-MM-DD形式に統一）
      let normalizedDate = item.date;
      if (item.date.includes('/')) {
        // M/D または MM/DD 形式の場合、YYYY-MM-DD に変換
        const dateParts = item.date.split('/');
        const currentYear = new Date().getFullYear();
        const month = dateParts[0].padStart(2, '0');
        const day = dateParts[1].padStart(2, '0');
        normalizedDate = `${currentYear}-${month}-${day}`;
      }
      historyMap.set(normalizedDate, item);
    });
    
    // 各日付に対応する履歴があればマッピング
    return sevenDays.map(day => ({
      ...day,
      hasResult: historyMap.has(day.date),
      result: historyMap.get(day.date)
    }));
  };
  
  useEffect(() => {
    if (!results) return;
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);
    logger.debug('結果データ (ApiResultData):', results);
    return () => clearTimeout(timer);
  }, [results]);

  // 履歴データを取得（過去7日分）
  useEffect(() => {
    const loadRecentHistory = async () => {
      setHistoryLoading(true);
      try {
        // 過去7日以上のデータを取得（余裕を持って20件取得）
        const response = await historyAPI.getUserHistory(20);
        if (response.success && response.history) {
          setRecentHistory(response.history);
          
          // 7日分のグリッドデータを生成
          const sevenDayData = mapHistoryTo7Days(response.history);
          setSevenDayHistory(sevenDayData);
          
          logger.debug('Recent history loaded:', response.history);
          logger.debug('Seven day history grid:', sevenDayData);
        }
      } catch (error) {
        const handledError = ErrorHandler.handleApiError(error, '履歴取得');
        logger.error('Failed to load recent history:', ErrorHandler.getUserFriendlyMessage(handledError));
      } finally {
        setHistoryLoading(false);
      }
    };

    loadRecentHistory();
  }, []);
  
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
  const problemArray = Array.isArray((results as any).results?.results) ? (results as any).results.results : (results as any).results;
  const correctAnswers = problemArray.filter((p: any) => p.isCorrect).length;
  const totalProblems = problemArray.length;
  
  const timeSpentInMilliseconds = (results as any).totalTime ?? ((results as any).results?.totalTime ?? 0);

  const score = (results as any)?.score ?? Math.round((correctAnswers / totalProblems) * 100);
  const problems = problemArray;
  const difficulty = results.difficulty;
  const rank = results.rank; // rankもAPIから取得
  
  // formatTime は dateUtils から利用

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
        <h1 className="text-3xl md:text-4xl font-bold mb-2" aria-label="けっかはっぴょう">🎉 <ruby>結果<rt>けっか</rt></ruby><ruby>発表<rt>はっぴょう</rt></ruby></h1>
        <div className="result-message bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 mx-auto max-w-md">
          <p className="text-lg md:text-xl font-semibold text-gray-800" dangerouslySetInnerHTML={{ __html: getResultMessage() }}></p>
        </div>
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
        <h2 className="text-xl font-semibold mb-4" aria-label="しょうさい">📊 <ruby>詳細<rt>しょうさい</rt></ruby></h2>
        <ul className="space-y-4">
          {problems && problems.length > 0 ? (
            problems.map((problem: any, index: number) => (
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

      {/* 過去7日の成績表示 */}
      <div className="seven-day-history bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">📅 過去7日の成績</h2>
        {historyLoading ? (
          <div className="text-center text-gray-500">履歴を読み込み中...</div>
        ) : (
          <div className="seven-day-grid">
            <div className="grid grid-cols-7 gap-2 md:gap-4">
              {/* ヘッダー行（日付） */}
              {sevenDayHistory.map((day, index) => (
                <div key={`header-${index}`} className="text-center text-xs md:text-sm font-medium text-gray-600 pb-2">
                  {day.dateDisplay}
                </div>
              ))}
              
              {/* データ行 */}
              {sevenDayHistory.map((day, index) => (
                <div 
                  key={`data-${index}`} 
                  className={`seven-day-cell p-2 md:p-3 rounded-lg border-2 text-center ${
                    day.hasResult 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {day.hasResult && day.result ? (
                    <div className="space-y-1">
                      <div className="text-xs md:text-sm font-medium text-blue-800">
                        {difficultyToJapanese(day.result.difficulty as any)}
                      </div>
                      <div className="text-lg md:text-xl font-bold text-blue-900">
                        {day.result.correctAnswers}/{day.result.totalProblems}
                      </div>
                      {day.result.rank && (
                        <div className="text-xs text-blue-600">
                          {day.result.rank}位
                        </div>
                      )}
                      <div className="text-xs text-gray-600">
                        {formatTime(day.result.timeSpent * 1000)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm md:text-base">
                      -
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* 凡例 */}
            <div className="mt-4 flex justify-center items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
                <span>挑戦あり</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
                <span>未挑戦</span>
              </div>
            </div>
          </div>
        )}
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