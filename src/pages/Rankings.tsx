import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/Rankings.css';
import { Results, UserData } from '@/types/index';
import { DifficultyRank } from '@/types/difficulty';
import { GRADE_OPTIONS } from '@/types/grades';
import { rankingAPI } from '../api/index';
import { format, subDays, eachDayOfInterval } from 'date-fns';

interface RankingsProps {
  results?: Results;
  selectedDifficulty?: DifficultyRank;
}

interface RankingItem {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  grade: string | number;
  difficulty: DifficultyRank;
  score: number;
  timeSpent: number;
  totalTime: number;
  correctAnswers: number;
  totalProblems: number;
  incorrectAnswers?: number;
  unanswered?: number;
  streak?: number;
  date: string;
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

export const Rankings: React.FC<RankingsProps> = ({ results }) => {
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
  
  const today = new Date();
  const lastWeek = subDays(today, 6);
  const dateOptions = eachDayOfInterval({ start: lastWeek, end: today })
    .map(date => format(date, 'yyyy-MM-dd'))
    .reverse();
  
  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0]);
  const [currentUser, setCurrentUser] = useState<UserData | null>(getUserData());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchRankings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
    try {
      const response = await rankingAPI.getDaily(
        50, // limit
        selectedDifficulty,
        format(today, 'yyyy-MM-dd') // date
      );
        
      if (response && response.success && response.data) {
        // APIレスポンスの実際の構造に合わせて修正
        const rankingsData = response.data.data || [];
        setRankings(rankingsData);
        } else {
        setError('ランキングデータの取得に失敗しました');
          setRankings([]);
        }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'ランキングの取得に失敗しました');
        setRankings([]);
      } finally {
        setIsLoading(false);
      }
  }, [selectedDifficulty]);
    
  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);
  
  // 所要時間のフォーマット（ミリ秒 -> 秒単位で小数点以下2桁まで表示）
  const formatTimeSpent = (timeInMilliseconds: number): string => {
    if (timeInMilliseconds === undefined || timeInMilliseconds === null || isNaN(timeInMilliseconds)) {
      return '-';
    }
    const timeInSeconds = timeInMilliseconds / 1000;
    return `${timeInSeconds.toFixed(2)}秒`;
  };

  // 学年の表示処理を改善
  const formatGrade = (grade: string | number | undefined): string => {
    if (grade === undefined || grade === null || grade === '') return '不明';
    
    const gradeStr = String(grade);

    // 数値または数値文字列 (小1～小6) の場合
    if (/^[1-6]$/.test(gradeStr)) {
      return `小${gradeStr}年生`;
    }
    
    // GRADE_OPTIONS からラベルを探す
    const option = GRADE_OPTIONS.find(opt => opt.value === gradeStr);
    if (option) {
      return option.label;
    }
    
    return gradeStr;
  };

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
            {dateOptions.map((dateStr, index) => (
              <option key={dateStr} value={dateStr}>
                {index === 0 ? '今日' : dateStr}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* ローディング表示 */}
      {isLoading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>ランキングを<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</p>
        </div>
      )}
      
      {/* エラー表示 */}
      {error && !isLoading && (
        <div className="error-message">
          <p>エラー: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            <ruby>再試行<rt>さいしこう</rt></ruby>
          </button>
        </div>
      )}
      
      {/* ランキングリスト */}
      {!isLoading && !error && (
        <div className="rankings-list">
          <div className="rankings-header">
            <div><ruby>順位<rt>じゅんい</rt></ruby></div>
          <div>ユーザー</div>
            <div><ruby>学年<rt>がくねん</rt></ruby></div>
            <div><ruby>正解数<rt>せいかいすう</rt></ruby></div>
            <div><ruby>所要時間<rt>しょようじかん</rt></ruby></div>
          </div>
          
          {rankings.length > 0 ? (
            rankings.map((ranking, index) => {
            // 現在のユーザーかどうかを判定
            const isCurrentUser = currentUser && ranking.username === currentUser.username;
              
            // クラス名を動的に設定
              const itemClassName = `ranking-item ${
                index < 3 ? `top-${index + 1}` : ''
              } ${isCurrentUser ? 'current-user-rank' : ''}`;

              // 順位に応じたアイコン
              const getRankIcon = (rank: number): string => {
                return `${rank}`;
              };

            return (
              <div 
                  key={`${ranking.userId}-${ranking.date}`}
                className={itemClassName}
              >
                  <div className="rank-column">
                    {getRankIcon(ranking.rank)}
                  </div>
                  <div className="user-column">
                    <span className="user-avatar">{ranking.avatar}</span>
                    <span className="username">{ranking.username}</span>
                    {isCurrentUser && <span className="you-badge">あなた</span>}
                  </div>
                <div className="grade-column">{formatGrade(ranking.grade)}</div>
                  <div className="score-column">
                    <span className="score-text">
                      {ranking.correctAnswers}/{ranking.totalProblems}
                    </span>
                  </div>
                <div className="time-column">
                  {formatTimeSpent(ranking.totalTime)}
                </div>
              </div>
            );
          })
        ) : (
            <div className="no-rankings">
              <p>{selectedDate}の{selectedDifficulty}ランキング<ruby>情報<rt>じょうほう</rt></ruby>がありません</p>
              <p className="no-rankings-hint">
                <ruby>別<rt>べつ</rt></ruby>の<ruby>日付<rt>ひづけ</rt></ruby>や<ruby>難易度<rt>なんいど</rt></ruby>を<ruby>選択<rt>せんたく</rt></ruby>してください
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* 統計情報 */}
      {!isLoading && !error && rankings.length > 0 && (
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
                  <span className="number">{(rankings.reduce((acc, r) => acc + r.correctAnswers, 0) / rankings.length).toFixed(1)}</span>
                  <span className="stat-unit">点</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label"><ruby>平均時間<rt>へいきんじかん</rt></ruby></div>
                <div className="stat-value">
                  <span className="number">{(rankings.reduce((acc, r) => acc + r.totalTime, 0) / rankings.length / 1000).toFixed(2)}</span>
                  <span className="stat-unit">秒</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rankings;