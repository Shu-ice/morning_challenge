import React, { useEffect, useState } from 'react';
import '../styles/UserHistory.css';
import { Results } from '@/types';
import { difficultyToJapanese } from '@/types/difficulty';
import { ErrorHandler } from './errorHandler';

interface UserHistoryProps {
  username: string;
}

interface HistoryItem extends Results {
  timestamp: string;
}

const UserHistory: React.FC<UserHistoryProps> = ({ username }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ローカルストレージからユーザーの履歴を取得
    const loadHistory = () => {
      setLoading(true);
      try {
        const historyData = localStorage.getItem(`user_history_${username}`);
        if (historyData) {
          const parsedHistory = JSON.parse(historyData) as HistoryItem[];
          // 日付の新しい順にソート
          parsedHistory.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setHistory(parsedHistory);
        }
      } catch (error) {
        const handledError = ErrorHandler.handleApiError(error, '履歴読み込み');
        console.warn(ErrorHandler.getUserFriendlyMessage(handledError));
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [username]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // 新しい時間フォーマット関数 (秒単位、小数点以下2桁)
  const formatHistoryTime = (milliseconds: number) => {
    const totalSeconds = milliseconds / 1000;
    return `${totalSeconds.toFixed(2)}秒`;
  };

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="user-history-container">
        <h1>{username}さんの学習履歴</h1>
        <div className="no-history">
          まだ学習履歴がありません。問題に挑戦して記録を作りましょう！
        </div>
      </div>
    );
  }

  return (
    <div className="user-history-container">
      <h1>{username}さんの学習履歴</h1>
      
      <div className="history-list">
        <div className="history-header">
          <div>日時</div>
          <div>難易度</div>
          <div>正解数</div>
          <div>所要時間</div>
          <div>順位</div>
        </div>
        
        {history.map((item, index) => (
          <div key={index} className="history-item">
            <div className="date-column">{formatDate(item.timestamp)}</div>
            <div className="difficulty-column">{difficultyToJapanese(item.difficulty)}</div>
            <div className="score-column">{item.correctAnswers}/{item.totalProblems}</div>
            <div className="time-column">
              {formatHistoryTime(item.timeSpent)}
            </div>
            <div className="rank-column">{item.rank || '-'}位</div>
          </div>
        ))}
      </div>
      
      <div className="summary">
        <h2>サマリー</h2>
        <div className="stats">
          <div className="stat-item">
            <div className="stat-label">総チャレンジ回数</div>
            <div className="stat-value">{history.length}回</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">平均正解率</div>
            <div className="stat-value">
              {history.reduce((acc, item) => acc + item.totalProblems, 0) > 0 ? 
                Math.round(
                  (history.reduce((acc, item) => acc + item.correctAnswers, 0) /
                  history.reduce((acc, item) => acc + item.totalProblems, 0)) * 100
                ) + '%'
                : '-'
              }
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">平均所要時間</div>
            <div className="stat-value">
              {history.length > 0 ? 
                formatHistoryTime(
                  history.reduce((acc, item) => acc + item.timeSpent, 0) / history.length
                )
                : '-'
              }
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">最高順位</div>
            <div className="stat-value">
              {history.some(item => item.rank) 
                ? Math.min(...history.filter(item => item.rank).map(item => item.rank || Infinity))
                : '-'}位
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserHistory; 