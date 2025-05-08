import React, { useState, useEffect } from 'react';
import { historyAPI } from '../api/index'; // ★ historyAPI をインポート
import { difficultyToJapanese, DifficultyRank } from '../types/difficulty'; // difficulty 関連をインポート
import '../styles/UserHistory.css'; // スタイルシートのパスを修正
import { UserData, ProblemResult } from '../types/index'; // UserData と ProblemResult をインポート
import axios from 'axios'; // ★ エラーハンドリングのために axios をインポート

// axios の直接インポートは不要になる
// import axios from 'axios'; 
// const api = axios.create(...); // api インスタンスも不要

interface HistoryItem { // 型定義を Result モデルに近づけるか、APIのレスポンスに合わせる
  _id: string; // _id を必須にする
  date: string;
  difficulty: DifficultyRank;
  grade?: number;
  totalProblems: number;
  correctAnswers: number;
  score: number;
  timeSpent: number;
  timestamp: string; // timestamp も必須にする
  rank?: number;
  // 以下のフィールドは Result モデルに含まれる可能性がある
  username?: string;
  userId?: string;
  problems?: ProblemResult[];
  incorrectAnswers?: number;
  unanswered?: number;
  totalTime?: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

const UserHistory = () => {
  const [user, setUser] = useState<UserData & { token: string } | null>(null); // user の型を UserData ベースに
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null); // ★ pagination state を復活
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1); // ★ currentPage と setCurrentPage を復活
  // ストリーク情報はAPIレスポンスから受け取るようにする
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);

  // ユーザー情報をlocalStorageから取得 (変更なし)
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUserInfo && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUserInfo) as UserData; // ★ UserData としてキャスト
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

  // 履歴データ取得関数 (historyAPI を使用するように変更)
  const fetchHistory = async () => {
    if (!user) { 
      setIsLoading(false);
      setHistory([]);
      setPagination(null); // ★ pagination もリセット
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[UserHistory] 履歴取得開始 using historyAPI.getUserHistory');
      
      // ★ historyAPI を使用
      const response = await historyAPI.getUserHistory(10); // limit は 10 固定など
      
      console.log('[UserHistory] APIレスポンス:', response);
          
      if (response.success && response.history) {
        // ★ HistoryItem 型に合わせてデータを整形 (必要であれば)
        //    API が返す history 配列の各要素が HistoryItem と互換性があるか確認
        setHistory(response.history);
        
        // ストリーク情報などもレスポンスに含まれていれば設定
        // setCurrentStreak(response.currentStreak || 0);
        // setMaxStreak(response.maxStreak || 0);
        
        // ★ APIレスポンスにページネーション情報があればセットする
        // setPagination(response.pagination || null);
          } else {
        // API は成功したが、データがないか形式が違う場合
        console.warn('[UserHistory] APIレスポンスに有効な履歴データが含まれていません:', response);
        setError(response.message || '履歴データの取得に失敗しました (形式エラー)。');
            setHistory([]);
        setPagination(null); // ★ エラー時もリセット
          }
    } catch (err: any) {
      console.error('[UserHistory] 履歴取得エラー:', err);
      // AxiosError かどうかをチェックし、メッセージを抽出
      let errorMessage = '履歴の取得中にエラーが発生しました。';
      if (axios.isAxiosError(err)) { // エラーが AxiosError か確認
          if (err.response) {
            // サーバーからのエラーレスポンス
            errorMessage = err.response.data?.message || `サーバーエラー (${err.response.status})`;
            if (err.response.status === 401) {
              errorMessage = '認証エラーが発生しました。再ログインしてください。';
              // 認証エラー時はユーザー情報をクリア
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            }
          } else if (err.request) {
            // レスポンスがない場合
            errorMessage = 'サーバーに接続できませんでした。';
          } else {
            // リクエスト設定エラーなど
            errorMessage = err.message;
        }
      } else if (err instanceof Error) {
          // Axios 以外のエラー
          errorMessage = err.message;
      }
      setError(errorMessage);
        setHistory([]);
      setPagination(null); // ★ エラー時もリセット
    } finally {
      setIsLoading(false);
    }
  };

  // ユーザー情報が変わったら履歴を取得
  useEffect(() => {
    if (user !== undefined) {
      fetchHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentPage]); // ★ currentPage が変わったときも再取得

  // ★ ページ変更ハンドラを復活
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && pagination && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  // 日付をフォーマットする関数
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A'; // undefined の場合に対応
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
  const formatTime = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds === null) return '-'; // undefined/null 対応
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
        <p>履歴を表示するには<a href="/login" className="text-blue-600 hover:underline">ログイン</a>してください。</p>
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
                  <tr key={item._id || `history-${index}`} className={`history-row ${index % 2 === 0 ? '' : 'even'}`}>
                    {/* timestampがあれば優先してフォーマット、なければdate、それもなければN/A */}
                    <td className="date-column">{formatDate(item.timestamp)}</td>
                    <td className="difficulty-column">{difficultyToJapanese(item.difficulty as DifficultyRank)}</td>
                    <td className="rank-column">{item.rank || '-'}</td>
                    <td className="correct-column">{`${item.correctAnswers ?? '?'} / ${item.totalProblems ?? 10}`}</td>
                    <td className="time-column">{formatTime(item.timeSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ★ ページネーション UI を復活 */} 
          {pagination && pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                前へ
              </button>
              <span>ページ {currentPage} / {pagination.totalPages}</span>
              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.totalPages}
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