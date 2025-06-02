import React, { useState, useMemo } from 'react';
import { useRankings, usePrefetchData } from '../hooks/useApiQuery';
import '../styles/Rankings.css';
import { DifficultyRank, difficultyToJapanese } from '../types/difficulty';

// 今日の日付を取得する関数
const getFormattedDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const Rankings: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(getFormattedDate(new Date()));
  const { prefetchRankings } = usePrefetchData();
  
  // 🚀 重複削除！全難易度を一度に取得
  const { data: allRankings, isLoading, error, refetch } = useRankings(selectedDate);
  
  // 統計情報を効率的に計算
  const statistics = useMemo(() => {
    if (!allRankings) return null;
    
    const stats = {
      beginner: { total: 0, avgScore: 0, avgTime: 0 },
      intermediate: { total: 0, avgScore: 0, avgTime: 0 },
      advanced: { total: 0, avgScore: 0, avgTime: 0 },
      expert: { total: 0, avgScore: 0, avgTime: 0 },
    };
    
    Object.entries(allRankings).forEach(([difficulty, rankings]) => {
      if (Array.isArray(rankings) && rankings.length > 0) {
        const totalScore = rankings.reduce((sum: number, r: any) => sum + (r.score || 0), 0);
        const totalTime = rankings.reduce((sum: number, r: any) => sum + (r.timeSpent || 0), 0);
        
        stats[difficulty as DifficultyRank] = {
          total: rankings.length,
          avgScore: rankings.length > 0 ? Math.round(totalScore / rankings.length) : 0,
          avgTime: rankings.length > 0 ? Math.round(totalTime / rankings.length) : 0,
        };
      }
    });
    
    return stats;
  }, [allRankings]);
  
  // 日付変更時の処理を最適化
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      setSelectedDate(newDate);
      // 新しい日付のデータをプリフェッチ
      prefetchRankings(newDate);
    }
  };
  
  // ローディング状態の改善
  if (isLoading) {
    return (
      <div className="rankings-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>ランキングを読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // エラー状態の改善
  if (error) {
    return (
      <div className="rankings-container">
        <div className="error-message">
          <p>データの取得に失敗しました</p>
          <button onClick={() => refetch()} className="retry-button">
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rankings-container">
      <div className="rankings-header">
        <h1 className="rankings-title">🏆 ランキング</h1>
        
        {/* 日付選択 */}
        <div className="date-selector">
          <label htmlFor="ranking-date">日付を選択:</label>
          <input
            type="date"
            id="ranking-date"
            value={selectedDate}
            onChange={handleDateChange}
            max={getFormattedDate(new Date())}
            className="date-input"
          />
        </div>
      </div>

      {/* 🚀 統計情報セクション - 1回のAPI呼び出しで全データを表示 */}
      {statistics && (
        <div className="ranking-stats">
          <h2>📊 統計情報</h2>
          <div className="stats-grid">
            {Object.entries(statistics).map(([difficulty, stats]) => (
              <div key={difficulty} className="stat-item">
                <h3>{difficultyToJapanese(difficulty as DifficultyRank)}</h3>
                <div className="stat-row">
                  <span className="stat-label">参加者数:</span>
                  <span className="stat-value">{stats.total}<span className="stat-unit">人</span></span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">平均スコア:</span>
                  <span className="stat-value">{stats.avgScore}<span className="stat-unit">点</span></span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">平均時間:</span>
                  <span className="stat-value">{stats.avgTime}<span className="stat-unit">秒</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ランキング表示 */}
      <div className="rankings-content">
        {(['beginner', 'intermediate', 'advanced', 'expert'] as DifficultyRank[]).map((difficulty) => {
          const rankings = allRankings?.[difficulty] || [];
          
          return (
            <div key={difficulty} className="difficulty-section">
              <div className="difficulty-header">
                <h2 className="difficulty-title">
                  {difficultyToJapanese(difficulty)}
                  <span className="participant-count">({rankings.length}人が参加)</span>
                </h2>
              </div>

              {rankings.length === 0 ? (
                <div className="no-data">
                  <p>この日のデータはありません</p>
                </div>
              ) : (
                <div className="ranking-table-wrapper">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>順位</th>
                        <th>ユーザー名</th>
                        <th>スコア</th>
                        <th>時間</th>
                        <th>正答率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.slice(0, 50).map((result: any, index: number) => (
                        <tr key={`${result.userId}-${index}`} className={index < 3 ? `rank-${index + 1}` : ''}>
                          <td className="rank-cell">
                            {index + 1}
                            {index === 0 && <span className="crown">👑</span>}
                            {index === 1 && <span className="crown">🥈</span>}
                            {index === 2 && <span className="crown">🥉</span>}
                          </td>
                          <td className="username-cell">{result.username || 'Unknown'}</td>
                          <td className="score-cell">{result.score || 0}点</td>
                          <td className="time-cell">{result.timeSpent || 0}秒</td>
                          <td className="accuracy-cell">
                            {result.totalProblems > 0 
                              ? Math.round((result.correctAnswers / result.totalProblems) * 100)
                              : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Rankings;