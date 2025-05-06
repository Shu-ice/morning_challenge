import React, { useState, useEffect } from 'react';
// import { Link } from 'react-router-dom'; // Link を削除
import axios from 'axios'; // axios を直接インポート
// import { useAuth } from '@/contexts/AuthContext'; // AuthContextの場所を要確認
// import { apiClient } from '@/api'; // 不要なインポートを削除
import { difficultyToJapanese, DifficultyRank } from '@/types/difficulty'; // DifficultyRankもインポート
import '@/styles/UserHistory.css'; // パスを修正

// axios インスタンスを作成
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

interface HistoryItem {
  id?: string;
  date?: string;
  difficulty: string;
  grade?: number;
  totalProblems?: number;
  correctAnswers?: number;
  score?: number;
  timeSpent: number;
  timestamp?: string;
  rank?: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

const UserHistory: React.FC = () => {
  // const { user } = useAuth(); // 一旦コメントアウト
  const [user, setUser] = useState<{ username: string, token: string, streak?: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);

  // ユーザー情報をlocalStorageから取得
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUserInfo && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUserInfo);
        setUser({ ...parsedUser, token: storedToken });
      } catch (e) {
        console.error("ユーザー情報の解析に失敗しました", e);
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } else {
      setUser(null); 
    }
  }, []);

  // 履歴データ取得関数
  const fetchHistory = async () => {
    if (!user || !user.token) {
      setIsLoading(false);
      setHistory([]);
      setPagination(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('履歴取得開始');
      
      // リクエスト設定
      const config = {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      };
      
      // 複数のエンドポイントを順番に試す（成功したら中断）
      let succeeded = false;
      
      // 方法1: /api/history エンドポイント（新しいAPI）
      if (!succeeded) {
        try {
          console.log('エンドポイント1: /api/history を試行');
          const response = await api.get('/history', config);
          
          if (response.data && (response.data.success || response.data.history || response.data.data)) {
            console.log('APIレスポンス (/api/history):', response.data);
            
            // レスポンス形式に応じたデータ取得
            if (response.data.history) {
              setHistory(response.data.history);
            } else if (response.data.data) {
              setHistory(response.data.data);
            } else {
              setHistory([]);
            }
            
            // ストリーク情報の取得
            if (response.data.currentStreak !== undefined) {
              setCurrentStreak(response.data.currentStreak);
            }
            if (response.data.maxStreak !== undefined) {
              setMaxStreak(response.data.maxStreak);
            }
            
            succeeded = true;
          }
        } catch (err) {
          console.warn('/api/history エンドポイントエラー:', err);
        }
      }
      
      // 方法2: /api/problems/history エンドポイント（バックアップAPI）
      if (!succeeded) {
        try {
          console.log('エンドポイント2: /api/problems/history を試行');
          const response = await api.get('/problems/history', config);
          
          if (response.data && (response.data.success || response.data.history || response.data.data)) {
            console.log('APIレスポンス (/api/problems/history):', response.data);
            
            // レスポンス形式に応じたデータ取得
            if (response.data.history) {
              setHistory(response.data.history);
            } else if (response.data.data) {
              setHistory(response.data.data);
            } else {
              setHistory([]);
            }
            
            // ストリーク情報の取得
            if (response.data.currentStreak !== undefined) {
              setCurrentStreak(response.data.currentStreak);
            }
            if (response.data.maxStreak !== undefined) {
              setMaxStreak(response.data.maxStreak);
            }
            
            succeeded = true;
          }
        } catch (err) {
          console.warn('/api/problems/history エンドポイントエラー:', err);
        }
      }
      
      // 両方のエンドポイントが失敗した場合
      if (!succeeded) {
        setError('履歴の取得に失敗しました。サーバーに接続できません。');
        setHistory([]);
      }
    } catch (err) {
      console.error('履歴取得エラー:', err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('認証エラーが発生しました。再ログインしてください。');
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } else {
        setError('履歴の取得に失敗しました。');
      }
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ユーザー情報が変わったら履歴を取得
  useEffect(() => {
    if (user !== undefined) {
      fetchHistory();
    }
  }, [user]);

  // ページ変更ハンドラ
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && pagination && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  // 日付をフォーマットする関数
  const formatDate = (dateString: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      };
      return new Date(dateString).toLocaleString('ja-JP', options);
    } catch (e) {
      console.error('日付フォーマットエラー:', e);
      return dateString;
    }
  };
  
  // 時間をフォーマットする関数 (秒 -> 0.01秒単位)
  const formatTime = (seconds: number) => {
    try {
      // 秒を小数点以下2桁まで表示
      return `${seconds.toFixed(2)}秒`;
    } catch (e) {
      console.error('時間フォーマットエラー:', e);
      return `${seconds}秒`;
    }
  };

  // 手動リロードボタン
  const handleRefresh = () => {
    fetchHistory();
  };

  // ユーザー情報の読み込み中
  if (user === undefined) {
    return <div className="user-history-container"><p>読み込み中...</p></div>;
  }

  // ログインしていない場合
  if (!user) {
    return (
      <div className="user-history-container">
        <h1>解答履歴</h1>
        <p>履歴を表示するには<a href="/login">ログイン</a>してください。</p>
      </div>
    );
  }

  return (
    <div className="user-history-container">
      <div className="history-header">
        <h1>{user.username}さんの解答履歴</h1>
        <button className="refresh-button" onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? '読み込み中...' : '更新'}
        </button>
      </div>

      {/* ストリーク情報の表示 */}
      {currentStreak > 0 && (
        <div className="streak-info">
          <div className="streak-badge">
            <span className="streak-icon">🔥</span>
            <span className="streak-count">{currentStreak}日</span>
          </div>
          <div className="streak-text">連続で問題に取り組んでいます！</div>
          {maxStreak > currentStreak && (
            <div className="max-streak">過去最高: {maxStreak}日</div>
          )}
        </div>
      )}

      {isLoading && <div className="loading-spinner">読み込み中...</div>}
      {error && <div className="error-message">{error}</div>}

      {!isLoading && !error && (!history || history.length === 0) && (
        <p className="no-history-message">まだ解答履歴がありません。</p>
      )}

      {!isLoading && !error && history && history.length > 0 && (
        <>
          <div className="history-list">
            <table className="history-table">
              <thead>
                <tr>
                  <th>実施日時</th>
                  <th>難易度</th>
                  <th>順位</th>
                  <th>正解数</th>
                  <th>解答時間</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={item.id || `history-${index}`} className={`history-row ${index % 2 === 0 ? '' : 'even'}`}>
                    {/* timestampがあれば優先してフォーマット、なければdate、それもなければN/A */}
                    <td className="date-column">{item.timestamp ? formatDate(item.timestamp) : (item.date || 'N/A')}</td>
                    <td className="difficulty-column">{difficultyToJapanese(item.difficulty as DifficultyRank)}</td>
                    <td className="rank-column">{item.rank || '-'}</td>
                    <td className="correct-column">{`${item.correctAnswers ?? '?'} / ${item.totalProblems ?? 10}`}</td>
                    <td className="time-column">{formatTime(item.timeSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ページネーションコントロール */}
          {pagination && pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-button"
              >
                前へ
              </button>
              <span className="pagination-info">ページ {currentPage} / {pagination.totalPages}</span>
              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.totalPages}
                className="pagination-button"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserHistory; 