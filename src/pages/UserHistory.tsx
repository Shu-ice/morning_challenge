import React, { useState, useEffect, useMemo } from 'react';
import { historyAPI } from '../api/index';
import { difficultyToJapanese, DifficultyRank } from '../types/difficulty';
import '../styles/UserHistory.css';
import { UserData, ProblemResult } from '../types/index';
import axios from 'axios';
import { logger } from '../utils/logger';
import { formatTime } from '../utils/dateUtils';

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
    logger.debug('=== ストリーク計算 ===');
    logger.debug('履歴データ数:', history?.length || 0);
    if (history && history.length > 0) {
      logger.debug('最初の履歴:', history[0]);
    }
    
    const result = calculateStreaks(history);
    logger.debug('計算結果:', result);
    logger.debug('=================');
    return result;
  }, [history]);

  // ユーザー情報をlocalStorageから取得
  useEffect(() => {
      const storedUserInfo = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUserInfo && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUserInfo) as UserData;
        if (parsedUser && typeof parsedUser === 'object' && parsedUser._id) {
          setUser({ ...parsedUser, token: storedToken });
        } else {
          logger.warn('[UserHistory] Invalid user data structure:', parsedUser);
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      } catch (e) {
        logger.error("ユーザー情報の解析に失敗しました", e instanceof Error ? e : String(e));
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
      logger.info('[UserHistory] 履歴取得開始');
      
      const response = await historyAPI.getUserHistory(50);
      logger.debug('=== API レスポンス ===');
      logger.debug('成功:', response.success);
      logger.debug('履歴件数:', response.history?.length || 0);
      if (response.history && response.history.length > 0) {
        logger.debug('最初の履歴項目:', response.history[0]);
      }
      logger.debug('==================');
      
      let historyArray: HistoryItem[] = [];
      if (response?.success && Array.isArray(response.history)) {
        historyArray = response.history.filter((item: HistoryItem) => {
          // 必須フィールドがあるかチェック
          return item && typeof item === 'object' && (item._id || item.date);
        });
        logger.info('[UserHistory] 有効な履歴データを検出:', historyArray.length, '件');
      } else if (response?.history && !Array.isArray(response.history)) {
        logger.warn('[UserHistory] History data is not an array:', typeof response.history);
        setError('履歴データの形式が異常です。');
        setHistory([]);
        return;
      }
      
      setHistory(historyArray);
      
      if (historyArray.length === 0 && response?.success) {
        logger.info('[UserHistory] No history data available (empty but successful response)');
      } else if (!response?.success) {
        logger.warn('[UserHistory] APIレスポンスに有効な履歴データが含まれていません:', response);
        setError(response?.message || '履歴データの取得に失敗しました。');
      }
    } catch (err: unknown) {
      logger.error('[UserHistory] 履歴取得エラー:', err instanceof Error ? err : String(err));
      let errorMessage = '履歴の取得中にエラーが発生しました。';
      
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.response?.status) {
          switch (err.response.status) {
            case 401:
              errorMessage = '認証エラーが発生しました。再ログインしてください。';
              setUser(null);
              localStorage.removeItem('user');
              localStorage.removeItem('token');
              break;
            case 403:
              errorMessage = 'アクセス権限がありません。';
              break;
            case 404:
              errorMessage = '履歴データが見つかりません。';
              break;
            case 500:
              errorMessage = 'サーバー内部エラーが発生しました。';
              break;
            default:
              errorMessage = `サーバーエラー (${err.response.status})`;
          }
        } else if (err.request) {
          errorMessage = 'サーバーに接続できませんでした。ネットワーク接続を確認してください。';
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error && err.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
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
      
      // 無効な日付をチェック
      if (isNaN(date.getTime())) {
        logger.warn('[UserHistory] Invalid date string:', dateString);
        return dateString; // 元の文字列を返す
      }
      
      // モバイル表示用の短い形式
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      
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
      logger.error('日付フォーマットエラー:', e instanceof Error ? e : String(e));
      return dateString || 'N/A';
    }
  };
  
  // formatTime は dateUtils から利用

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
      <section className="streak-cards" aria-labelledby="streak-section-title">
        <h2 id="streak-section-title" className="visually-hidden">継続記録</h2>
        <div className="streak-card current-streak-card" role="img" aria-labelledby="current-streak-label">
          <div className="streak-icon-large" aria-hidden="true">🔥</div>
          <div className="streak-number" aria-label={`現在の連続記録 ${currentStreak}日`}>{currentStreak}</div>
          <div id="current-streak-label" className="streak-label"><ruby>現在<rt>げんざい</rt></ruby>の<ruby>連続記録<rt>れんぞくきろく</rt></ruby></div>
          <div className="streak-description">
            <ruby>毎日<rt>まいにち</rt></ruby>の<ruby>継続<rt>けいぞく</rt></ruby>が<ruby>素晴<rt>すば</rt></ruby>らしい<ruby>成果<rt>せいか</rt></ruby>を<ruby>生<rt>う</rt></ruby>みます
          </div>
          <div className="motivation-message">
            {getMotivationMessage(currentStreak)}
          </div>
        </div>
        
        <div className="streak-card max-streak-card" role="img" aria-labelledby="max-streak-label">
          <div className="streak-icon-large" aria-hidden="true">👑</div>
          <div className="streak-number" aria-label={`自己最高連続記録 ${maxStreak}日`}>{maxStreak}</div>
          <div id="max-streak-label" className="streak-label"><ruby>自己最高連続記録<rt>じこさいこうれんぞくきろく</rt></ruby></div>
          <div className="streak-unit"><ruby>日連続<rt>にちれんぞく</rt></ruby></div>
        </div>
      </section>

      {/* ローディング表示 */}
      {isLoading && (
        <div className="loading-container" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p><ruby>履歴<rt>りれき</rt></ruby>を<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</p>
        </div>
      )}

      {/* エラー表示 */}
      {!isLoading && error && (
        <div className="error-container" role="alert" aria-live="assertive">
          <p className="error-message">{error}</p>
          <button 
            onClick={handleRefresh} 
            className="retry-button"
            aria-label="履歴の再読み込みを実行"
          >
            <ruby>再試行<rt>さいしこう</rt></ruby>
          </button>
        </div>
      )}

      {/* データなし表示 */}
      {!isLoading && !error && (!history || history.length === 0) && (
        <div className="no-history-container" role="status">
          <p className="no-history-message">まだ<ruby>解答履歴<rt>かいとうりれき</rt></ruby>がありません。</p>
          <p className="no-history-hint">
            <ruby>計算<rt>けいさん</rt></ruby>チャレンジに<ruby>挑戦<rt>ちょうせん</rt></ruby>して<ruby>履歴<rt>りれき</rt></ruby>を<ruby>作<rt>つく</rt></ruby>りましょう！
          </p>
        </div>
      )}

      {/* 履歴リスト */}
      {!isLoading && !error && history && history.length > 0 && (
        <section className="history-list-container" aria-labelledby="history-section-title">
          <header className="history-header-info">
            <h2 id="history-section-title"><ruby>挑戦履歴<rt>ちょうせんりれき</rt></ruby> ({history.length}<ruby>件<rt>けん</rt></ruby>)</h2>
            <button 
              onClick={handleRefresh} 
              className="refresh-button" 
              disabled={isLoading}
              aria-label="履歴を最新の状態に更新"
              aria-describedby="refresh-status"
            >
              <span id="refresh-status" className="visually-hidden">
                {isLoading ? '更新中です' : '更新ボタン'}
              </span>
              {isLoading ? (
                <>
                  <ruby>更新中<rt>こうしんちゅう</rt></ruby>...
                </>
              ) : (
                <ruby>更新<rt>こうしん</rt></ruby>
              )}
            </button>
          </header>

          <div className="history-table-container" role="region" aria-labelledby="history-section-title">
            <table 
              className="history-table" 
              role="table"
              aria-label="学習履歴の詳細データ"
              aria-rowcount={history.length + 1}
              aria-colcount={5}
            >
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr role="row">
                  <th scope="col" aria-sort="none" tabIndex={0}>
                    <ruby>実施日時<rt>じっしにちじ</rt></ruby>
                  </th>
                  <th scope="col" aria-sort="none" tabIndex={0}>
                    <ruby>難易度<rt>なんいど</rt></ruby>
                  </th>
                  <th scope="col" aria-sort="none" tabIndex={0}>
                    <ruby>順位<rt>じゅんい</rt></ruby>
                  </th>
                  <th scope="col" aria-sort="none" tabIndex={0}>
                    <ruby>正解数<rt>せいかいすう</rt></ruby>
                  </th>
                  <th scope="col" aria-sort="none" tabIndex={0}>
                    <ruby>解答時間<rt>かいとうじかん</rt></ruby>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr 
                    key={item._id || `history-${index}`} 
                    className="history-row"
                    role="row"
                    aria-rowindex={index + 2}
                    tabIndex={0}
                    aria-label={`${index + 1}件目の履歴: ${formatDate(item.timestamp)}, 難易度${difficultyToJapanese(item.difficulty as DifficultyRank)}, ${item.rank ? `${item.rank}位` : '順位なし'}, ${item.correctAnswers ?? '?'}/${item.totalProblems ?? 10}問正解, ${formatTime(item.totalTime || item.timeSpent)}`}
                  >
                    <td role="gridcell" aria-label={`実施日時: ${formatDate(item?.timestamp || item?.date)}`}>
                      {formatDate(item?.timestamp || item?.date)}
                    </td>
                    <td role="gridcell" aria-label={`難易度: ${difficultyToJapanese((item?.difficulty || 'beginner') as DifficultyRank)}`}>
                      <span 
                        className={`difficulty-badge difficulty-${item?.difficulty || 'beginner'}`}
                        role="img"
                        aria-label={`難易度: ${difficultyToJapanese((item?.difficulty || 'beginner') as DifficultyRank)}`}
                      >
                        {difficultyToJapanese((item?.difficulty || 'beginner') as DifficultyRank)}
                      </span>
                    </td>
                    <td role="gridcell" aria-label={item?.rank ? `順位: ${item.rank}位` : '順位: 記録なし'}>
                      {item?.rank ? (
                        <span 
                          className={`rank-badge ${item.rank <= 3 ? `rank-${item.rank}` : ''}`}
                          role="img"
                          aria-label={`${item.rank}位`}
                        >
                          {item.rank}<ruby>位<rt>い</rt></ruby>
                        </span>
                      ) : (
                        <span aria-label="順位記録なし">-</span>
                      )}
                    </td>
                    <td role="gridcell" aria-label={`正解数: ${item?.correctAnswers ?? '?'}問中${item?.totalProblems ?? 10}問`}>
                      <span className="score-display">
                        {item?.correctAnswers ?? '?'} / {item?.totalProblems ?? 10}
                      </span>
                    </td>
                    <td role="gridcell" aria-label={`解答時間: ${formatTime(item?.totalTime || item?.timeSpent)}`}>
                      {formatTime(item?.totalTime || item?.timeSpent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default UserHistory; 