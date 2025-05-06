import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Problems.css';
// import { useNavigate, useLocation } from 'react-router-dom'; // useNavigate を削除
// import { useAuth } from '@/contexts/AuthContext'; // Use localStorage instead for now
import type { Problem, ProblemResult, Results, UserData } from '../types/index'; // 相対パスに変更
import { problemsAPI } from '../api/index'; // ★ パスに index を明示的に含める
// import { generateProblems } from '@/utils/problemGenerator'; // フロントエンド生成は不要に
import { DifficultyRank, difficultyToJapanese } from '../types/difficulty'; // 相対パスに変更
import { usePreciseCountdown } from '../hooks/usePreciseCountdown'; // 相対パスに変更
import axios, { isAxiosError } from 'axios';  // axiosのインポートをコメントアウト
import { format } from 'date-fns'; // date-fns などの日付ライブラリを使用

interface ProblemData {
  id: number;
  question: string;
  userAnswer?: number | null;
  isCorrect?: boolean;
  type?: string;
}

interface ProblemsProps {
  difficulty: DifficultyRank;
  onComplete: (results: any) => void;
  onBack: () => void;
}

// シード付き乱数生成関数
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// 日付からシード値を生成
const getDateSeed = () => {
  const now = new Date();
  const dateString = `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed += dateString.charCodeAt(i);
  }
  return seed;
};

// 日付文字列を取得（YYYY-MM-DD形式）
const getDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// ユーザーデータを取得するヘルパー
const getUserData = (): UserData | null => {
  try {
    // 'userData'ではなく'user'キーを使用(API responseに合わせる)
    const userDataString = localStorage.getItem('user');
    if (!userDataString) return null;
    
    const userData = JSON.parse(userDataString);
    // 必要なプロパティが存在するか確認
    if (!userData.username) {
      console.error('User data missing username', userData);
      return null;
    }
    
    // isLoggedInプロパティを追加
    return {
      ...userData,
      isLoggedIn: true,
      userId: userData.id || userData._id || userData.userId // idまたは_idからuserIdを設定
    };
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

// 完了情報をチェック (ユーザー名を考慮)
const hasCompletedTodaysProblems = (difficulty: DifficultyRank) => {
  // テスト用に、チェックを一時的に無効化
  return false;
  
  /* 一時的にコメントアウト
  const currentUser = getUserData();
  if (!currentUser) return false; // 未ログイン時は未完了扱い

  try {
    const completionData = localStorage.getItem('mathChallengeCompletion');
    if (!completionData) return false;

    const parsedData = JSON.parse(completionData);
    const today = getDateString();

    return parsedData.some((item: any) =>
      item.date === today &&
      item.difficulty === difficulty &&
      item.username === currentUser.username // ★ ユーザー名もチェック
    );
  } catch (error) {
    console.error('Failed to check completion status:', error);
    return false;
  }
  */
};

// 完了情報を保存 (ユーザー名を考慮)
const saveCompletionData = (difficulty: DifficultyRank) => {
  const currentUser = getUserData();
  if (!currentUser) return; // 未ログイン時は保存しない

  try {
    const completionData = localStorage.getItem('mathChallengeCompletion') || '[]';
    const parsedData = JSON.parse(completionData);

    parsedData.push({
      date: getDateString(),
      difficulty,
      username: currentUser.username, // ★ ユーザー名を追加
      timestamp: new Date().toISOString()
    });

    // 古いデータを削除するなど、必要に応じて件数制限を設けても良い
    // const MAX_COMPLETION_RECORDS = 500;
    // if (parsedData.length > MAX_COMPLETION_RECORDS) {
    //   parsedData.sort((a:any, b:any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    //   parsedData.splice(MAX_COMPLETION_RECORDS);
    // }

    localStorage.setItem('mathChallengeCompletion', JSON.stringify(parsedData));
  } catch (error) {
    console.error('Failed to save completion data:', error);
  }
};

// 前回の難易度を取得
export const getLastUsedDifficulty = (): DifficultyRank => {
  try {
    const completionData = localStorage.getItem('mathChallengeCompletion');
    if (!completionData) return 'beginner';
    
    const parsedData = JSON.parse(completionData);
    // 日付の降順でソート
    parsedData.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // 最新のエントリからdifficultyを取得
    if (parsedData.length > 0 && parsedData[0].difficulty) {
      return parsedData[0].difficulty as DifficultyRank;
    }
    
    return 'beginner';
  } catch (error) {
    console.error('Failed to get last used difficulty:', error);
    return 'beginner';
  }
};

// スコア計算関数 (仮)
const calculateScore = (correct: number, total: number, time: number): number => {
  if (total === 0) return 0;
  const accuracyScore = (correct / total) * 100;
  // 簡単なスコアリング：正答率を返す (時間による減点などは加えない)
  return Math.round(accuracyScore);
};

// YYYY-MM-DD形式の日付文字列を取得する関数
const getFormattedDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 時間フォーマット関数 (秒単位、小数点以下2桁)
const formatTime = (milliseconds: number) => {
  const totalSeconds = milliseconds / 1000;
  // 小数点以下は常に2桁表示
  return `${totalSeconds.toFixed(2)}秒`;
};

const Problems: React.FC<ProblemsProps> = ({ difficulty, onComplete, onBack }) => {
  // const { user } = useAuth(); // Comment out useAuth
  const [currentUser, setCurrentUser] = useState<UserData & { token: string } | null>(null); // Store user with token
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<ProblemData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showStart, setShowStart] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // ★ より確実な方法で初期化
  // ★ 初期値の確認ログを追加
  useEffect(() => {
    console.log('[Problems] Initial selectedDate:', selectedDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回レンダリング時のみ実行
  const { count: remainingTime, startCountdown } = usePreciseCountdown(300);

  // Load user data and token from localStorage
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('user'); 
    const storedToken = localStorage.getItem('token');
    if (storedUserInfo && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUserInfo);
        // ユーザーIDを確保
        const userId = parsedUser.id || parsedUser._id || parsedUser.userId;
        if (!userId) {
          console.warn("ユーザー情報にIDが含まれていません。再ログインが必要かもしれません。");
        }
        setCurrentUser({ 
          ...parsedUser, 
          token: storedToken,
          userId: userId // userIdを明示的に設定
        });
      } catch (e) {
        console.error("Failed to parse user info from localStorage", e);
        setCurrentUser(null);
        // Optionally clear invalid stored data
        // localStorage.removeItem('userData');
        // localStorage.removeItem('token');
      }
    } else {
       setCurrentUser(null); 
       setIsLoading(false); // ユーザーデータがない場合もロード完了
    }
  }, []);

  // カウントダウン完了時の処理を定義 (useCallbackでメモ化)
  const handleCountdownComplete = useCallback(() => {
    console.log("Countdown complete, starting game!");
    setIsStarted(true);      // ゲーム開始状態にする
    setStartTime(Date.now()); // 開始時間を記録
    setElapsedTime(0);      // 経過時間リセット
    // 最初の問題にフォーカス
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, []); // 依存配列は空でOK (setIsStartedなどは安定している想定)

  // 作成したカスタムフックを使用
  const { count: currentCountdownValue, startCountdown: countdownStart } = usePreciseCountdown(1000, handleCountdownComplete);

  // ★ カウントダウン表示のエフェクト
  useEffect(() => {
    if (currentCountdownValue === 0) {
      setShowStart(true);
      // 0.7秒後に非表示にする
      const timer = setTimeout(() => {
        setShowStart(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [currentCountdownValue]);

  // ★ handleStart を修正 - 時間チェックを追加
  const handleStart = () => {
    if (problems.length === 0) {
        setError("問題がロードされていません。リフレッシュしてください。");
      return;
    }
    
    // 時間チェック（管理者は除外）
    const isAdmin = currentUser?.isAdmin === true;
    if (!isAdmin) {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hours + minutes/60;
      
      // 時間制限チェック: 朝6:30-8:00のみ利用可能
      if (currentTime < 6.5 || currentTime > 8.0) {
        setError('問題は朝6:30から8:00の間のみ利用可能です。');
        return;
      }
    }
    
    console.log("開始ボタンがクリックされました - カウントダウン開始");
    // エラーをクリア
    setError(null);
    countdownStart(3);
  };

  // inputの値が変わったときのハンドラ
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Input changed:', event.target.value); // デバッグログ
    
    // 空の入力、数字、小数点、マイナス記号を許可
    const value = event.target.value;
    const numericRegex = /^-?[0-9]*\.?[0-9]*$/; // マイナス記号と小数点を許可
    
    if (value === '' || numericRegex.test(value)) {
      setCurrentAnswer(value);
    }
  };

  // Enterキーまたは「次へ」ボタンで回答を確定し次に進む
  const handleNext = () => {
    if (currentIndex >= problems.length) {
      return; // すでに最後の問題
    }

    // 現在の回答を保存
    const newAnswers = [...answers];
    newAnswers[currentIndex] = currentAnswer;
    setAnswers(newAnswers);

    // 次の問題へ
    if (currentIndex < problems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentAnswer(''); // 次の問題のために回答欄をクリア
    } else {
      // 全問完了 (回答配列は最新のものが setAnswers で更新されている)
      handleComplete(newAnswers); // ★ 最終的な回答配列を渡す
    }
  };

   // キーボードイベント（Enterキー）のハンドラ
   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // フォーム送信を防止
      handleNext();
    }
  };

  // フォーカスが外れたときのハンドラ
  const handleBlur = () => {
    // 入力値を保存
    if (currentIndex < problems.length) {
      const newAnswers = [...answers];
      newAnswers[currentIndex] = currentAnswer;
      setAnswers(newAnswers);
    }
  };

  // ★ handleComplete をサーバー送信ロジックに変更
  const handleComplete = async (finalAnswers: string[]) => {
    if (timerRef.current) {
      clearInterval(timerRef.current); // タイマー停止
    }
    setIsStarted(false); // 開始状態を解除
    setIsLoading(true); // ローディング表示を開始
    setError(null);

    const finalElapsedTime = startTime ? Date.now() - startTime : elapsedTime; // 最終的な経過時間
    const timeSpentInSeconds = finalElapsedTime / 1000;

    try {
      // サーバーに送信するデータを作成
      if (!currentUser?.userId) {
          setError("ユーザー情報が見つかりません。結果を送信できませんでした。");
          setIsLoading(false);
          return;
      }
      const submissionData = {
        difficulty: difficulty,
        date: selectedDate,
        answers: finalAnswers,
        timeSpent: timeSpentInSeconds,
        userId: currentUser.userId
      };

      console.log("回答を提出します:", submissionData);

      // APIを使用して結果を送信
      try {
        const responseData = await problemsAPI.submitAnswers(submissionData);
        
        if (!responseData.success) {
          setError(`結果の送信に失敗しました: ${responseData.message}`);
          console.error("回答提出エラー:", responseData.message);
          return;
        }
        
        console.log("回答提出成功:", responseData);
        
        // 結果データを作成
        const resultsData: Results = {
            difficulty: difficulty,
          totalProblems: problems.length,
          correctAnswers: responseData.results?.correctAnswers || 0,
          incorrectAnswers: responseData.results?.incorrectAnswers || 0,
          unanswered: responseData.results?.unanswered || 0,
          totalTime: timeSpentInSeconds * 1000,
          timeSpent: timeSpentInSeconds,
          problems: responseData.results?.problems || [],
          score: responseData.results?.score || 0,
          grade: currentUser?.grade || 0
        };
        
        // レスポンスからrankフィールドがあれば追加
        if (responseData.results?.rank) {
          resultsData.rank = responseData.results.rank;
        }
        
        // 結果表示画面に結果を渡す
        onComplete(resultsData);
        
      } catch (error) {
        console.error('回答提出エラー:', error);
        setError('サーバーとの通信に失敗しました。ネットワーク接続を確認してください。');
      }
      
    } catch (error) {
      console.error('回答の計算中にエラーが発生しました:', error);
      setError('結果の計算中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // ★ 日付変更ハンドラー
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        setSelectedDate(newDate);
        // Reset game state when date changes
        setIsStarted(false);
        setCurrentIndex(0);
        setCurrentAnswer('');
        setElapsedTime(0);
        setStartTime(null);
    } else {
        console.warn("Invalid date format selected:", newDate);
    }
  };

  // handleSubmitResults
  const handleSubmitResults = useCallback(async (finalResults: Results) => {
    if (!currentUser?.token) {
      console.error('Cannot submit results without user token');
      setError('結果の送信に失敗しました。ログイン状態を確認してください。');
      return;
    }
    console.log("Submitting results:", finalResults);

    try {
      await axios.post('/api/results', finalResults, {
         headers: {
            Authorization: `Bearer ${currentUser.token}`,
            'Content-Type': 'application/json'
          },
         baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000' 
      });
      onComplete(finalResults);
    } catch (error) {
      console.error('Error submitting results:', error);
      setError('結果の送信中にエラーが発生しました。');
    }
  }, [currentUser?.token, onComplete]);

  // useEffect for timeout
  useEffect(() => {
      // remainingTime が 0 以下になり、かつゲームが開始されている場合
      if (isStarted && remainingTime !== null && remainingTime <= 0 && problems.length > 0) { // ★ isStarted を条件に追加
          console.log("Time's up!");
          // タイムアウトした場合も handleComplete を呼び出す
          // その時点での回答状況 (answers) を渡す
          handleComplete(answers); // ★ calculateResults の代わりに handleComplete を呼ぶ
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingTime, isStarted, problems, answers, handleComplete]); // ★ 依存配列に isStarted, handleComplete を追加し、不要なものを削除

  // ★★★ 問題間の「戻る」ボタンのハンドラを復活 ★★★
  const handleBack = () => {
    if (currentIndex > 0) {
      // 現在の入力も念のため保存しておく
      const newAnswers = [...answers];
      newAnswers[currentIndex] = currentAnswer;
      setAnswers(newAnswers);
      // インデックスをデクリメント
      setCurrentIndex(currentIndex - 1);
      // 前の回答をセット（useEffectでもセットされるが、即時反映のため）
      // setCurrentAnswer(answers[currentIndex - 1] || '');
    }
  };

  // 問題ロードと完了チェック (APIキャッシュを導入)
  useEffect(() => {
    if (!currentUser || !currentUser.token) {
      if (!currentUser && !localStorage.getItem('token')) {
          setError("問題を取得するにはログインが必要です。");
      }
      setIsLoading(false);
      return;
    }

    // 完了チェックも selectedDate を基準にする
    if (selectedDate === getFormattedDate(new Date()) && hasCompletedTodaysProblems(difficulty)) {
      setAlreadyCompleted(true);
      setError(`今日はすでにこの難易度の問題に取り組みました。`);
      setIsLoading(false);
      return;
    } else {
      setAlreadyCompleted(false);
      setError(null);
    }

    const loadProblems = async () => {
      // セッションストレージによるキャッシュキーを作成
      const cacheKey = `problems_${difficulty}_${selectedDate}`;
      const cachedProblems = sessionStorage.getItem(cacheKey);
      
      try {
        setIsLoading(true);
        setError(null);
        
        // キャッシュがある場合はそれを使用
        if (cachedProblems) {
          try {
            const parsedProblems = JSON.parse(cachedProblems);
            setProblems(parsedProblems);
            setIsLoading(false);
            return;
          } catch (parseError) {
            console.warn('問題キャッシュの解析に失敗しました:', parseError);
          }
        }

        // ユーザー情報を取得
        const userData = getUserData();
        if (!userData || !userData.userId) {  // usernameの代わりにuserIdをチェック
          throw new Error('ユーザーIDが取得できません。再ログインしてください。');
        }

        // APIを使用して問題を取得 (ユーザーIDを渡す)
        const currentUserId = userData.userId;  // usernameの代わりにuserIdを使用
        
        console.log(`問題を取得します: 難易度=${difficulty}, 日付=${selectedDate}, ユーザーID=${currentUserId}`);
        
        // 問題取得はAPIクライアントを使用
        try {
          const problemsData = await problemsAPI.getProblems(difficulty, selectedDate);
          console.log('API応答:', problemsData);
          
          if (problemsData.success && problemsData.problems && problemsData.problems.length > 0) {
            // 問題データを整形
            const formattedProblems = problemsData.problems.map((problem: any, index: number) => ({
              id: problem.id || index,
              question: problem.question,
              type: problem.type || 'mixed'
            }));
            
            console.log(`${formattedProblems.length}問の問題を取得しました`);
            setProblems(formattedProblems);
            
            // 問題をセッションストレージにキャッシュ
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(formattedProblems));
            } catch (cacheError) {
              console.warn('問題キャッシュの保存に失敗しました:', cacheError);
            }
          } else {
            // データが空の場合
            const errorMsg = problemsData.message || `${selectedDate}の${difficultyToJapanese(difficulty)}問題は見つかりませんでした。`;
            throw new Error(errorMsg);
          }
        } catch (apiError: any) {
          console.error('API呼び出しエラー:', apiError);
          throw apiError;
        }
      } catch (err: any) {
        console.error('問題の取得中にエラーが発生しました:', err);
        let errorMessage = '問題の取得中にエラーが発生しました。';
        
        if (err.response) {
          // エラーレスポンス
          errorMessage = err.response.data?.message || err.response.data?.error || `エラー (${err.response.status})`;
        } else if (err.request) {
          // リクエストは送信されたが、レスポンスがない
          errorMessage = 'サーバーに接続できませんでした。ネットワークを確認してください。';
        } else {
          // その他のエラー
          errorMessage = err.message || '予期せぬエラーが発生しました。';
        }
        
        setError(errorMessage);
        setProblems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProblems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, selectedDate, currentUser]);

  // ★ 経過時間タイマー (これは isStarted をトリガーにするので変更なし)
  useEffect(() => {
    if (isStarted && startTime !== null) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100); // 100msごとに更新 (表示は formatTime で調整)
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStarted, startTime]);

  // ★ inputへのフォーカス (これも isStarted をトリガーにするので変更なし)
  useEffect(() => {
    if (isStarted && currentIndex < problems.length) {
      // 非同期でフォーカスを設定（レンダリング完了後に確実にフォーカスするため）
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // フォーカスが確実に設定されたか確認
          console.log('Input focused:', document.activeElement === inputRef.current);
        }
      }, 100);

      // 以前の回答があれば入力欄にセット
      setCurrentAnswer(answers[currentIndex] || '');
    }
  }, [currentIndex, isStarted, problems.length, answers]);

  // --- レンダリングロジック ---
  
  if (isLoading) {
    // ★ ローディング表示はシンプルに
    return <div className="text-center p-10">読み込み中...</div>;
  }

  // ★ エラー or 完了済みの場合は専用表示 (日付選択は含めない)
  if (error) { // alreadyCompleted も error ステートにメッセージを設定するようになったはず
      return (
          <div className="text-center p-10">
              <p className="mb-4 text-red-500">{error}</p>
              <button onClick={() => window.location.reload()} className="button button-secondary">ページ再読み込み</button>
          </div>
      );
  }

  // Handle case where user info is still loading
  if (currentUser === undefined) {
      return <div className="problems-container">ユーザー情報を読み込み中...</div>; 
  }

  // --- 通常の表示フロー --- 
  return (
    // ★ problems-container クラスをトップレベルに (以前の構造に近い想定)
    <div className="problems-container max-w-2xl mx-auto p-4 md:p-6">

      {/* ヘッダー情報: ログインユーザー、難易度、日付 */} 
      <div className="flex justify-between items-center mb-4 text-sm">
         {currentUser && (
            <div className="text-gray-600">
               ログイン中: <span className="font-bold">{currentUser.username}</span>
            </div>
         )}
         {/* 日付選択を追加 (右上に配置するイメージ) */} 
         <div className="date-selector text-right">
             <label htmlFor="problem-date" className="mr-2">日付:</label>
             <input
                 type="date"
                 id="problem-date"
                 value={selectedDate}
                 onChange={handleDateChange}
                 max={getFormattedDate(new Date())}
                 disabled={isStarted}
                 className="p-1 border rounded text-sm" // シンプルなスタイル
             />
         </div>
      </div>

      {/* 開始前画面 (isStarted が false で、 countdown が null または表示完了後) */}
      {!isStarted && (currentCountdownValue === null || !showStart) && (
        <div className="text-center p-10">
          <h2 className="text-2xl font-bold mb-4">{difficultyToJapanese(difficulty)} ({selectedDate})</h2>
          {/* 問題数が0件の場合 (APIエラーとは別) */}
          {problems.length === 0 && !isLoading && (
             <p className="mb-6 text-red-500">選択された日付の問題が見つかりませんでした。</p>
          )}
          {/* 問題がある場合 */}
          {problems.length > 0 && (
            <>
              <p className="mb-6">
                {problems.length}問の問題に挑戦します。<br/>
                できるだけ早く、正確に解きましょう！
              </p>
              <button
                onClick={handleStart} // handleStart 内で startCountdown(3) が呼ばれる
                className="button button-primary button-large"
                disabled={isLoading} // ローディング中は無効
              >
                開始する
              </button>
            </>
          )}
          {/* 常に表示されるホームボタン */}
          <button onClick={onBack} className="button button-secondary mt-4">戻る</button>
        </div>
      )}

      {/* カウントダウン表示 (isStarted が false で、countdown 中) */}
      {!isStarted && showStart && currentCountdownValue !== null && currentCountdownValue > 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-9xl font-bold countdown-number animate-pulse">
            {currentCountdownValue / 1000} {/* 秒で表示 */} 
          </div>
          <div className="mt-4 text-xl text-gray-600">
            準備してください...
          </div>
        </div>
      )}

      {/* ゲーム中の表示 (isStarted が true) */}
      {isStarted && problems.length > 0 && currentIndex < problems.length && (
        // ★ 以前の problem-view に相当する構造を再現
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* カウントダウン完了直後の「スタート！」表示 */} 
          {showStart && currentCountdownValue === 0 && (
            <div className="fixed inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-9xl font-bold countdown-start animate-bounce">
                スタート!
              </div>
            </div>
          )}
          
          {/* プログレスバーとタイマー */} 
          <div className="flex justify-between items-center mb-6 text-lg font-medium">
            <div>
              問題 {currentIndex + 1} / {problems.length}
            </div>
            <div className="text-primary-600">
              経過時間: {formatTime(elapsedTime)}
            </div>
          </div>

          {/* 問題文 */} 
          <div className="problem-text text-3xl font-bold text-center mb-8">
            {problems[currentIndex].question}
          </div>

          {/* 回答入力欄 */} 
          <div className="answer-section flex flex-col items-center justify-center">
            <input
              ref={inputRef}
              id="answer-input" // IDを追加 (もしCSSで使っていれば)
              type="text" // number より text の方が入力しやすい場合も
              inputMode="decimal" // モバイルでの数値キーボード表示を促す
              autoComplete="off"
              value={currentAnswer}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className="answer-input w-full max-w-xs p-3 text-xl text-center border-2 border-gray-300 rounded-md focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition duration-150 ease-in-out mb-6"
              placeholder="答えを入力"
              autoFocus // ゲーム開始時にフォーカス
            />
            {/* ナビゲーションボタン */} 
            <div className="navigation-buttons flex justify-center gap-4 w-full">
                <button
                  onClick={handleBack}
                  className="button button-secondary"
                  disabled={currentIndex === 0}
                >
                  戻る
                </button>
                <button
                  onClick={handleNext}
                  className="button button-primary"
                >
                  {currentIndex === problems.length - 1 ? '完了' : '次へ'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Problems;