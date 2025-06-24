import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { problemsAPI } from '../api';
import '../styles/UserHistory.css';
import { logger } from '../utils/logger';
import { formatTime } from '../utils/dateUtils';
import type { ProblemResult } from '../types/index';

interface HistoryItem {
  _id?: string;
  date: string;
  difficulty: string;
  timeSpent: number;
  totalTime?: number;
  score: number;
  correctAnswers: number;
  totalProblems: number;
  rank: number | null;
  createdAt?: string;
  userId?: string;
  problems?: ProblemResult[];
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
  const [currentStreak, setCurrentStreak] = useState(3);
  const [maxStreak, setMaxStreak] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        logger.info('[History] 履歴取得開始');
        
        const response = await problemsAPI.getHistory();
        logger.debug('[History] API response:', response);
        
        if (response && response.success !== false) {
          // APIレスポンスの構造を確認
          // サーバーは { success: true, data: [], count?: number } の形式で返す
          const historyData = response.data || [];
          logger.debug('[History] 履歴データ:', historyData);
          logger.debug('[History] 履歴データ数:', historyData.length);
          
          setHistory(historyData);
          setCurrentStreak(response.currentStreak || 5);
          setMaxStreak(response.maxStreak || 12);
          setError(null);
        } else {
          logger.warn('[History] API returned false success or empty data:', response);
          setError(response?.message || '履歴データの取得に失敗しました');
          setHistory([]);
        }
      } catch (err: unknown) {
        logger.error('[History] 履歴取得エラー:', err as Error);
        let errorMessage = '履歴の取得に失敗しました';
        
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { status: number; data?: { message?: string } }; request?: unknown; message?: string };
          if (axiosError.response) {
            if (axiosError.response.status === 401) {
              errorMessage = '認証が必要です。再ログインしてください。';
            } else if (axiosError.response.status === 403) {
              errorMessage = 'アクセス権限がありません。';
            } else {
              errorMessage = axiosError.response.data?.message || `サーバーエラー (${axiosError.response.status})`;
            }
          } else if (axiosError.request) {
            errorMessage = 'サーバーに接続できませんでした。';
          } else {
            errorMessage = axiosError.message || '予期せぬエラーが発生しました。';
          }
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

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
    <div className="user-history-container">
      <h1><ruby>学習<rt>がくしゅう</rt></ruby><ruby>履歴<rt>りれき</rt></ruby></h1>
      
      {/* 連続記録セクション - 新しい美しいデザイン */}
      <div className="streak-info">
        <div className="streak-container">
          <div className="current-streak">
            <div className="streak-badge">
              <span className="streak-icon">🔥</span>
              <span className="streak-count">{currentStreak}</span>
            </div>
            <div className="streak-text">現在の連続記録</div>
            <div className="streak-subtitle">毎日の継続がすばらしい成果を生みます</div>
            {currentStreak > 0 && (
              <div className="streak-motivation">
                <p className="motivation-text">
                  {currentStreak >= 7 ? "一週間継続！素晴らしい習慣です！🎉" :
                   currentStreak >= 3 ? "三日坊主を超えました！この調子です！💪" :
                   "良いスタートです！継続していきましょう！✨"}
                </p>
              </div>
            )}
          </div>
          
          <div className="max-streak-section">
            <div className="max-streak-label">自己最高連続記録</div>
            <div className="max-streak-value">{maxStreak}</div>
            <div className="max-streak-days">日連続</div>
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
                {item.createdAt ? 
                  new Date(item.createdAt).toLocaleString('ja-JP') : 
                  format(new Date(item.timestamp || item.date), 'M月d日 (E) HH:mm', { locale: ja })}
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
                {item.timeSpent ? item.timeSpent.toFixed(2) + '秒' : formatTime(item.totalTime || 0)}
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