import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/Rankings.css';
import { Results, UserData } from '@/types/index';
import { DifficultyRank } from '@/types/difficulty';
import { GRADE_OPTIONS } from '@/types/grades';
import { rankingAPI } from '../api/index';
// date-fnsの使用を停止
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';
import { formatTime, gradeLabel } from '../utils/dateUtils';
import { ErrorHandler } from '../utils/errorHandler';

interface RankingsProps {
  results?: Results;
  selectedDifficulty?: DifficultyRank;
}

interface RankingItem {
  rank: number;
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  grade: string | number;
  level?: number;
  currentStreak?: number;
  correctCount: number;
  totalTimeSec: number;
  // Legacy fields for compatibility
  difficulty?: DifficultyRank;
  score?: number;
  timeSpent?: number;
  totalTime?: number;
  correctAnswers?: number;
  totalProblems?: number;
  incorrectAnswers?: number;
  unanswered?: number;
  streak?: number;
  date?: string;
}

// ユーザーデータを取得するヘルパー関数
const getUserData = (): UserData | null => {
  try {
    const possibleKeys = ['userData', 'user', 'currentUser'];
    
    for (const key of possibleKeys) {
      const userDataString = localStorage.getItem(key);
      if (userDataString) {
        try {
          const data = JSON.parse(userDataString);
          return data;
        } catch (e) {
          console.error(`キー ${key} のユーザーデータの解析に失敗しました:`, e);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

export const Rankings: React.FC<RankingsProps> = React.memo(({ results }) => {
  const location = useLocation();
  
  // 結果ページからの難易度情報を取得（複数のソースから）
  const getInitialDifficulty = (): DifficultyRank => {
    // 1. location.state から取得
    const passedDifficulty = location.state?.selectedDifficulty;
    if (passedDifficulty) {
      console.log(`[Rankings] Using difficulty from location.state: ${passedDifficulty}`);
      return passedDifficulty;
    }
    
    // 2. localStorage から取得（結果ページから保存されたもの）
    const savedDifficulty = localStorage.getItem('selectedDifficultyFromResults');
    if (savedDifficulty) {
      console.log(`[Rankings] Using difficulty from localStorage: ${savedDifficulty}`);
      // 使用後は削除（一回限りの使用）
      localStorage.removeItem('selectedDifficultyFromResults');
      return savedDifficulty as DifficultyRank;
    }
    
    // 3. デフォルト値
    console.log(`[Rankings] Using default difficulty: beginner`);
    return 'beginner';
  };
  
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>(
    getInitialDifficulty()
  );
  
  // 過去7日間の日付オプションを生成（メモ化）
  const dateOptions = useMemo((): string[] => {
    const options: string[] = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      options.push(dateString);
    }
    
    return options;
  }, []); // 日付は日次で変更されるため、依存配列は空でOK
  
  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0]);
  const [currentUser, setCurrentUser] = useState<UserData | null>(getUserData());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ★ fetchRankings関数を修正 - useApiWithRetryを使わずにシンプルにする
  const fetchRankings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`[Rankings] Fetching rankings: difficulty=${selectedDifficulty}, date=${selectedDate}`);
      
      const response = await rankingAPI.getDaily(
        50, // limit
        selectedDifficulty,
        selectedDate // ★ selectedDateを使用
      );
      
      if (!response || !response.success) {
        throw new Error('ランキングデータの取得に失敗しました');
      }

      // ★ 新しいAPIレスポンス構造に対応
      const rankingsData = response.data?.leaderboard || response.data?.data || response.data || [];
      setRankings(rankingsData);
      
      // データが空の場合はエラーではなく正常状態
      if (rankingsData.length === 0) {
        console.log(`[ランキング] ${selectedDate} の ${selectedDifficulty} データなし - 正常`);
      }
    } catch (err: unknown) {
      const handledError = ErrorHandler.handleApiError(err, 'ランキング取得');
      setError(ErrorHandler.getUserFriendlyMessage(handledError));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDifficulty, selectedDate]); // ★ selectedDateを依存配列に追加
    
  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);
  
  // formatTime は dateUtils から利用
  const formatTimeSpent = formatTime; // 後方互換のためのエイリアス

  // 学年の表示処理（統一ユーティリティを使用、メモ化）
  const formatGrade = useCallback((grade: string | number | undefined): string => {
    if (grade === undefined || grade === null || grade === '') return '不明';
    
    const gradeStr = String(grade);

    // Backend already provides Japanese labels, so display them directly
    // If it's already a Japanese label, return as is
    if (gradeStr.includes('年生') || gradeStr === 'ひみつ' || gradeStr === '大学生' || gradeStr === '社会人') {
      return gradeStr;
    }

    // 統一ユーティリティを使用
    return gradeLabel(grade);
  }, []);

  return (
    <div className="rankings-container">
      <h1><ruby>ランキング<rt>らんきんぐ</rt></ruby></h1>
      
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="difficulty-select"><ruby>難易度<rt>なんいど</rt></ruby>:</label>
          <select 
            value={selectedDifficulty} 
            onChange={(e) => setSelectedDifficulty(e.target.value as DifficultyRank)}
            className="filter-select"
          >
            <option value="beginner">初級</option>
            <option value="intermediate">中級</option>
            <option value="advanced">上級</option>
            <option value="expert">超級</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="date-select"><ruby>日付<rt>ひづけ</rt></ruby>:</label>
          <select 
            id="date-select"
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="filter-select"
            disabled={isLoading}
          >
            {dateOptions.map((dateStr: string, index: number) => (
              <option key={dateStr} value={dateStr}>
                {index === 0 ? '今日' : dateStr}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* ローディング表示 - Skeleton UI */}
      {isLoading && (
        <div className="space-y-6">
          <SkeletonLoader variant="rectangular" height={200} className="w-full rounded-lg" />
          <SkeletonLoader variant="ranking" lines={10} />
          <SkeletonLoader variant="card" height={150} />
        </div>
      )}
      
      {/* エラー表示と統一リトライ機能 */}
      {!isLoading && error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button 
            onClick={fetchRankings}
            className="retry-button"
          >
            再試行
          </button>
        </div>
      )}

      {/* データなし表示 */}
      {!isLoading && !error && rankings.length === 0 && (
        <div className="no-rankings">
          <p>{selectedDate}の{selectedDifficulty}ランキング<ruby>情報<rt>じょうほう</rt></ruby>がありません</p>
          <p className="no-rankings-hint">
            <ruby>別<rt>べつ</rt></ruby>の<ruby>日付<rt>ひづけ</rt></ruby>や<ruby>難易度<rt>なんいど</rt></ruby>を<ruby>選択<rt>せんたく</rt></ruby>してください
          </p>
        </div>
      )}
      
      {/* ランキングリスト */}
      {!isLoading && !error && rankings.length > 0 && (
        <div className="rankings-list">
          <table className="ranking-table" role="table" aria-label="ランキング一覧">
            <colgroup>
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col"><ruby>順位<rt>じゅんい</rt></ruby></th>
                <th scope="col">ユーザー</th>
                <th scope="col"><ruby>学年<rt>がくねん</rt></ruby></th>
                <th scope="col"><ruby>正解数<rt>せいかいすう</rt></ruby></th>
                <th scope="col"><ruby>所要時間<rt>しょようじかん</rt></ruby></th>
              </tr>
            </thead>
            <tbody>
          
          {rankings.map((ranking, index) => {
            // 現在のユーザーかどうかを判定
            const isCurrentUser = currentUser && (ranking.username === currentUser.username || ranking.userId === currentUser._id);
              
            // クラス名を動的に設定 - 履歴ページと同じ方式
              const trClasses = [];
              if (index < 3) {
                trClasses.push(`top-${index + 1}`);
              }
              if (isCurrentUser) {
                trClasses.push('current-user-rank');
              }
              const itemClassName = trClasses.join(' ');

              // 順位に応じたアイコン
              const getRankIcon = (rank: number): string => {
                return `${rank}`;
              };

            return (
              <tr 
                key={`${ranking.userId}-${ranking.date}`}
                className={itemClassName}
              >
                <td className="rank-column">
                  {index + 1 <= 3 ? ['🥇', '🥈', '🥉'][index] : ''} {getRankIcon(ranking.rank)}
                </td>
                <td className="user-column">
                  <span className="username">{ranking.displayName || ranking.username}</span>
                  {isCurrentUser && <span className="you-badge">あなた</span>}
                  {ranking.level && <span className="level-badge">Lv.{ranking.level}</span>}
                </td>
                <td className="grade-column">{formatGrade(ranking.grade)}</td>
                <td className="score-column">
                  <span className="score-text">
                    {ranking.correctCount || ranking.correctAnswers || 0}/10
                  </span>
                  {ranking.currentStreak > 0 && <span className="streak-badge">🔥{ranking.currentStreak}</span>}
                </td>
                <td className="time-column">
                  {formatTimeSpent(ranking.totalTimeSec ? ranking.totalTimeSec * 1000 : (ranking.totalTime ?? ranking.timeSpent))}
                </td>
              </tr>
            );
          })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* 統計情報 */}
      {!isLoading && rankings.length > 0 && (
        <div className="ranking-stats">
          <div className="stats-card">
            <h3><ruby>統計情報<rt>とうけいじょうほう</rt></ruby></h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label"><ruby>参加者数<rt>さんかしゃすう</rt></ruby></div>
                <div className="stat-value">
                  <span className="number">{rankings.length}</span>
                  <span className="stat-unit">人</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label"><ruby>平均点<rt>へいきんてん</rt></ruby></div>
                <div className="stat-value">
                  <span className="number">{(rankings.reduce((acc, r) => acc + (r.correctCount || r.correctAnswers || 0), 0) / rankings.length).toFixed(1)}</span>
                  <span className="stat-unit">点</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label"><ruby>平均時間<rt>へいきんじかん</rt></ruby></div>
                <div className="stat-value">
                  <span className="number">{(rankings.reduce((acc, r) => acc + (r.totalTimeSec || (r.totalTime ?? r.timeSpent) / 1000), 0) / rankings.length).toFixed(2)}</span>
                  <span className="stat-unit">秒</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

Rankings.displayName = 'Rankings';

export default Rankings;