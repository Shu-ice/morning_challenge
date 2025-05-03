import React, { useEffect, useState } from 'react';
import '../styles/UserHistory.css';
import { Results } from '../types';
import { difficultyToJapanese } from '../utils/problemGenerator';
import { DifficultyRank } from '@/types/difficulty';

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
        console.error('履歴の読み込みに失敗しました:', error);
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

  // 所要時間のフォーマット (秒単位で小数点以下2桁まで表示)
  const formatTimeSpent = (timeInSeconds: number) => {
    // 小数点以下が整数の場合も小数点以下2桁まで表示（四捨五入せず元の値を維持）
    return `${timeInSeconds.toFixed(2)}秒`;
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
        <table className="history-table">
          <thead>
            <tr>
              <th>日時</th>
              <th>難易度</th>
              <th>正解数</th>
              <th>所要時間</th>
              <th>順位</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, index) => (
              <tr key={index} className={`history-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                <td className="date-column">{formatDate(item.timestamp)}</td>
                <td className="difficulty-column">{difficultyToJapanese(item.difficulty as DifficultyRank)}</td>
                <td className="score-column">{item.correctAnswers}/{item.totalProblems}</td>
                <td className="time-column">
                  {formatTimeSpent(item.timeSpent)}
                </td>
                <td className="rank-column">{item.rank || '-'}位</td>
              </tr>
            ))}
          </tbody>
        </table>
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
              {Math.round(
                (history.reduce((acc, item) => acc + item.correctAnswers, 0) /
                history.reduce((acc, item) => acc + item.totalProblems, 0)) * 100
              )}%
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">平均所要時間</div>
            <div className="stat-value">
              {(
                history.reduce((acc, item) => acc + item.timeSpent, 0) / history.length
              ).toFixed(2)}秒
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">最高順位</div>
            <div className="stat-value">
              {history.some(item => item.rank) 
                ? Math.min(...history.filter(item => item.rank).map(item => item.rank as number)) 
                : '-'}位
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserHistory; 