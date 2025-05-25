import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { problemsAPI } from '../api';
import '../styles/UserHistory.css';

interface HistoryItem {
  _id?: string;
  date: string;
  difficulty: string;
  timeSpent: number;
  score: number;
  correctAnswers: number;
  totalProblems: number;
  rank: number | null;
  createdAt?: string;
  userId?: string;
  problems?: any[];
  timestamp?: string;
}

interface HistoryResponse {
  success: boolean;
  history: HistoryItem[];
  currentStreak: number;
  maxStreak: number;
}

export const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[History] 履歴取得開始');
        
        const response = await problemsAPI.getHistory();
        console.log('[History] API response:', response);
        
        if (response && response.success !== false) {
          // APIレスポンスの構造を確認
          // サーバーは { success: true, data: [], count?: number } の形式で返す
          const historyData = response.data || [];
          console.log('[History] 履歴データ:', historyData);
          console.log('[History] 履歴データ数:', historyData.length);
          
          setHistory(historyData);
          setCurrentStreak(response.currentStreak || 0);
          setMaxStreak(response.maxStreak || 0);
          setError(null);
        } else {
          console.warn('[History] API returned false success or empty data:', response);
          setError(response?.message || '履歴データの取得に失敗しました');
          setHistory([]);
        }
      } catch (err: any) {
        console.error('[History] 履歴取得エラー:', err);
        let errorMessage = '履歴の取得に失敗しました';
        
        if (err.response) {
          if (err.response.status === 401) {
            errorMessage = '認証が必要です。再ログインしてください。';
          } else if (err.response.status === 403) {
            errorMessage = 'アクセス権限がありません。';
          } else {
            errorMessage = err.response.data?.message || `サーバーエラー (${err.response.status})`;
          }
        } else if (err.request) {
          errorMessage = 'サーバーに接続できませんでした。';
        } else {
          errorMessage = err.message || '予期せぬエラーが発生しました。';
        }
        
        setError(errorMessage);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatTime = (seconds: number) => {
    return seconds.toFixed(2);
  };

  const getDifficultyName = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初級';
      case 'intermediate': return '中級';
      case 'advanced': return '上級';
      case 'expert': return '超級';
      default: return difficulty;
    }
  };

  if (loading) {
    return (
      <div className="history-container">
        <h1><ruby>学習<rt>がくしゅう</rt></ruby><ruby>履歴<rt>りれき</rt></ruby></h1>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p><ruby>履歴<rt>りれき</rt></ruby>を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-container">
        <h1><ruby>学習<rt>がくしゅう</rt></ruby><ruby>履歴<rt>りれき</rt></ruby></h1>
        <div className="error-message">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            <ruby>再試行<rt>さいしこう</rt></ruby>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <h1><ruby>学習<rt>がくしゅう</rt></ruby><ruby>履歴<rt>りれき</rt></ruby></h1>
      
      {/* 連続記録セクション */}
      <div className="streak-section">
        <h2 className="streak-title"><ruby>連続<rt>れんぞく</rt></ruby><ruby>記録<rt>きろく</rt></ruby></h2>
        <div className="streak-grid">
          <div className="streak-card current-streak">
            <p className="streak-label"><ruby>現在<rt>げんざい</rt></ruby>の<ruby>連続<rt>れんぞく</rt></ruby><ruby>記録<rt>きろく</rt></ruby></p>
            <p className="streak-number">
              {currentStreak > 0 ? `${currentStreak}日連続` : 'まだ記録がありません'}
            </p>
          </div>
          <div className="streak-card max-streak">
            <p className="streak-label"><ruby>自己<rt>じこ</rt></ruby><ruby>最高<rt>さいこう</rt></ruby><ruby>連続<rt>れんぞく</rt></ruby><ruby>記録<rt>きろく</rt></ruby></p>
            <p className="streak-number">
              {maxStreak > 0 ? `${maxStreak}日連続` : 'まだ記録がありません'}
            </p>
          </div>
        </div>
      </div>

      {/* 履歴リスト */}
      <div className="history-list">
        <div className="history-header">
          <div><ruby>実施<rt>じっし</rt></ruby><ruby>日時<rt>にちじ</rt></ruby></div>
          <div><ruby>難易度<rt>なんいど</rt></ruby></div>
          <div><ruby>順位<rt>じゅんい</rt></ruby></div>
          <div><ruby>正解数<rt>せいかいすう</rt></ruby></div>
          <div><ruby>解答時間<rt>かいとうじかん</rt></ruby></div>
        </div>
        
        {history.length > 0 ? (
          history.map((item, index) => (
            <div 
              key={index}
              className="history-item"
            >
              <div className="date-column">
                {format(new Date(item.timestamp || item.createdAt || item.date), 'M月d日 (E) HH:mm', { locale: ja })}
              </div>
              <div className="difficulty-column">
                {getDifficultyName(item.difficulty)}
              </div>
              <div className="rank-column">
                {'-'}
              </div>
              <div className="score-column">
                <span className="score-text">
                  {item.correctAnswers}/{item.totalProblems}
                </span>
              </div>
              <div className="time-column">
                {formatTime(item.timeSpent)}秒
              </div>
            </div>
          ))
        ) : (
          <div className="no-history">
            <p>まだ<ruby>学習<rt>がくしゅう</rt></ruby><ruby>履歴<rt>りれき</rt></ruby>がありません</p>
            <p className="no-history-hint">
              <ruby>問題<rt>もんだい</rt></ruby>を<ruby>解<rt>と</rt></ruby>いて<ruby>履歴<rt>りれき</rt></ruby>を<ruby>作<rt>つく</rt></ruby>りましょう
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 