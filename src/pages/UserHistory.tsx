import React, { useState, useEffect, useMemo } from 'react';
import { historyAPI } from '../api/index';
import { difficultyToJapanese, DifficultyRank } from '../types/difficulty';
import '../styles/UserHistory.css';
import { UserData, ProblemResult } from '../types/index';
import axios from 'axios';

interface HistoryItem {
  _id: string;
  date: string;
  difficulty: DifficultyRank;
  grade?: number;
  totalProblems: number;
  correctAnswers: number;
  score: number;
  timeSpent: number;
  timestamp: string;
  rank?: number;
  username?: string;
  userId?: string;
  problems?: ProblemResult[];
  incorrectAnswers?: number;
  unanswered?: number;
  totalTime?: number;
}

// ストリーク計算関数
const calculateStreaks = (history: HistoryItem[]) => {
  if (!history || history.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  // 日付のみを抽出してユニークにする
  const uniqueDates = [...new Set(
    history.map(item => {
      const date = new Date(item.timestamp || item.date);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    })
  )].sort();

  if (uniqueDates.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  // 今日の日付
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 現在のストリーク計算（今日または昨日から開始）
  let currentStreak = 0;
  const latestDate = uniqueDates[uniqueDates.length - 1]; // 最新日付

  if (latestDate === today || latestDate === yesterday) {
    // 最新日から遡って連続日数をカウント
    let checkDate = new Date(latestDate);
    
    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      const targetDate = checkDate.toISOString().split('T')[0];
      
      if (uniqueDates[i] === targetDate) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // 最大ストリーク計算
  let maxStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      tempStreak++;
    } else {
      maxStreak = Math.max(maxStreak, tempStreak);
      tempStreak = 1;
    }
  }
  maxStreak = Math.max(maxStreak, tempStreak);

  return { currentStreak, maxStreak };
};

const UserHistory = () => {
  const [user, setUser] = useState<UserData & { token: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ストリーク情報を計算
  const { currentStreak, maxStreak } = useMemo(() => {
    console.log('=== ストリーク計算 ===');
    console.log('履歴データ数:', history?.length || 0);
    if (history && history.length > 0) {
      console.log('最初の履歴:', history[0]);
    }
    
    const result = calculateStreaks(history);
    console.log('計算結果:', result);
    console.log('=================');
    return result;
  }, [history]);

  // ユーザー情報をlocalStorageから取得
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUserInfo && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUserInfo) as UserData;
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
    if (!user) { 
      setIsLoading(false);
      setHistory([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[UserHistory] 履歴取得開始');
      
      const response = await historyAPI.getUserHistory(50);
      console.log('=== API レスポンス ===');
      console.log('成功:', response.success);
      console.log('履歴件数:', response.history?.length || 0);
      if (response.history && response.history.length > 0) {
        console.log('最初の履歴項目:', response.history[0]);
      }
      console.log('==================');
      
      let historyArray = null;
      if (response.success && Array.isArray(response.history)) {
        historyArray = response.history;
        console.log('[UserHistory] 有効な履歴データを検出:', historyArray.length, '件');
      }
      
      if (historyArray) {
        setHistory(historyArray);
      } else {
        console.warn('[UserHistory] APIレスポンスに有効な履歴データが含まれていません:', response);
        setError(response.message || '履歴データの取得に失敗しました。');
        setHistory([]);
      }
    } catch (err: any) {
      console.error('[UserHistory] 履歴取得エラー:', err);
      let errorMessage = '履歴の取得中にエラーが発生しました。';
      if (axios.isAxiosError(err)) {
        if (err.response) {
          errorMessage = err.response.data?.message || `サーバーエラー (${err.response.status})`;
          if (err.response.status === 401) {
            errorMessage = '認証エラーが発生しました。再ログインしてください。';
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        } else if (err.request) {
          errorMessage = 'サーバーに接続できませんでした。';
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 日付をフォーマットする関数
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      
      // モバイル表示用の短い形式
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        const options: Intl.DateTimeFormatOptions = { 
          month: 'numeric', day: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        };
        return date.toLocaleString('ja-JP', options);
      } else {
        const options: Intl.DateTimeFormatOptions = { 
          year: 'numeric', month: 'short', day: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        };
        return date.toLocaleString('ja-JP', options);
      }
    } catch (e) {
      console.error('日付フォーマットエラー:', e);
      return dateString;
    }
  };
  
  // 時間をフォーマットする関数
  const formatTime = (milliseconds: number | undefined): string => {
    if (milliseconds === undefined || milliseconds === null || isNaN(milliseconds)) return '-';
    try {
      const seconds = milliseconds / 1000;
      return `${seconds.toFixed(2)}秒`;
    } catch (e) {
      console.error('時間フォーマットエラー:', e);
      return `${milliseconds} ms`;
    }
  };

  // 手動リロードボタン
  const handleRefresh = () => {
    fetchHistory();
  };

  // モチベーションメッセージ生成
  const getMotivationMessage = (streak: number): string => {
    if (streak >= 30) return "1ヶ月継続！圧倒的な成長力です！🏆";
    if (streak >= 14) return "2週間継続！素晴らしい習慣が身についています！🌟";
    if (streak >= 7) return "1週間継続！素晴らしい習慣です！🎉";
    if (streak >= 3) return "3日坊主を超えました！この調子です！💪";
    if (streak >= 1) return "良いスタートです！継続していきましょう！✨";
    return "今日から始めてみましょう！📚";
  };

  // ユーザー情報の読み込み中
  if (user === undefined) {
    return (
      <div className="user-history-container">
        <div className="loading-container">
          <p><ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</p>
        </div>
      </div>
    );
  }

  // ログインしていない場合
  if (!user) {
    return (
      <div className="user-history-container">
        <h1><ruby>学習履歴<rt>がくしゅうりれき</rt></ruby></h1>
        <div className="login-prompt">
          <p><ruby>履歴<rt>りれき</rt></ruby>を<ruby>表示<rt>ひょうじ</rt></ruby>するには<a href="/login" className="login-link"><ruby>ログイン<rt>ろぐいん</rt></ruby></a>してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-history-container">
      <h1><ruby>学習履歴<rt>がくしゅうりれき</rt></ruby></h1>

      {/* ストリーク情報カード */}
      <div className="streak-cards">
        <div className="streak-card current-streak-card">
          <div className="streak-icon-large">🔥</div>
          <div className="streak-number">{currentStreak}</div>
          <div className="streak-label"><ruby>現在<rt>げんざい</rt></ruby>の<ruby>連続記録<rt>れんぞくきろく</rt></ruby></div>
          <div className="streak-description">
            <ruby>毎日<rt>まいにち</rt></ruby>の<ruby>継続<rt>けいぞく</rt></ruby>が<ruby>素晴<rt>すば</rt></ruby>らしい<ruby>成果<rt>せいか</rt></ruby>を<ruby>生<rt>う</rt></ruby>みます
          </div>
          <div className="motivation-message">
            {getMotivationMessage(currentStreak)}
          </div>
        </div>
        
        <div className="streak-card max-streak-card">
          <div className="streak-icon-large">👑</div>
          <div className="streak-number">{maxStreak}</div>
          <div className="streak-label"><ruby>自己最高連続記録<rt>じこさいこうれんぞくきろく</rt></ruby></div>
          <div className="streak-unit"><ruby>日連続<rt>にちれんぞく</rt></ruby></div>
        </div>
      </div>

      {/* ローディング表示 */}
      {isLoading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p><ruby>履歴<rt>りれき</rt></ruby>を<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</p>
        </div>
      )}

      {/* エラー表示 */}
      {!isLoading && error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            <ruby>再試行<rt>さいしこう</rt></ruby>
          </button>
        </div>
      )}

      {/* データなし表示 */}
      {!isLoading && !error && (!history || history.length === 0) && (
        <div className="no-history-container">
          <p className="no-history-message">まだ<ruby>解答履歴<rt>かいとうりれき</rt></ruby>がありません。</p>
          <p className="no-history-hint">
            <ruby>計算<rt>けいさん</rt></ruby>チャレンジに<ruby>挑戦<rt>ちょうせん</rt></ruby>して<ruby>履歴<rt>りれき</rt></ruby>を<ruby>作<rt>つく</rt></ruby>りましょう！
          </p>
        </div>
      )}

      {/* 履歴リスト */}
      {!isLoading && !error && history && history.length > 0 && (
        <div className="history-list-container">
          <div className="history-header-info">
            <h2><ruby>挑戦履歴<rt>ちょうせんりれき</rt></ruby> ({history.length}<ruby>件<rt>けん</rt></ruby>)</h2>
            <button onClick={handleRefresh} className="refresh-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <ruby>更新中<rt>こうしんちゅう</rt></ruby>...
                </>
              ) : (
                <ruby>更新<rt>こうしん</rt></ruby>
              )}
            </button>
          </div>

          <div className="history-table-container">
            <table className="history-table">
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th><ruby>実施日時<rt>じっしにちじ</rt></ruby></th>
                  <th><ruby>難易度<rt>なんいど</rt></ruby></th>
                  <th><ruby>順位<rt>じゅんい</rt></ruby></th>
                  <th><ruby>正解数<rt>せいかいすう</rt></ruby></th>
                  <th><ruby>解答時間<rt>かいとうじかん</rt></ruby></th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={item._id || `history-${index}`} className="history-row">
                    <td>{formatDate(item.timestamp)}</td>
                    <td>
                      <span className={`difficulty-badge difficulty-${item.difficulty}`}>
                        {difficultyToJapanese(item.difficulty as DifficultyRank)}
                      </span>
                    </td>
                    <td>
                      {item.rank ? (
                        <span className={`rank-badge ${item.rank <= 3 ? `rank-${item.rank}` : ''}`}>
                          {item.rank}<ruby>位<rt>い</rt></ruby>
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className="score-display">
                        {item.correctAnswers ?? '?'} / {item.totalProblems ?? 10}
                      </span>
                    </td>
                    <td>
                      {formatTime(item.totalTime || item.timeSpent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserHistory; 