import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Problems.css';
// import { useNavigate, useLocation } from 'react-router-dom'; // useNavigate を削除
// import { useAuth } from '@/contexts/AuthContext'; // Use localStorage instead for now
import type { Problem, ProblemResult, Results, UserData } from '../types/index'; // Results をインポート
import { problemsAPI } from '../api/index'; // ★ パスに index を明示的に含める
// import { generateProblems } from '@/utils/problemGenerator'; // フロントエンド生成は不要に
import { DifficultyRank, difficultyToJapanese } from '../types/difficulty'; // 相対パスに変更
import { usePreciseCountdown } from '../hooks/usePreciseCountdown'; // 相対パスに変更
import axios, { isAxiosError } from 'axios';  // axiosのインポートをコメントアウト
import { format } from 'date-fns'; // date-fns などの日付ライブラリを使用
import { useProblem } from '../contexts/ProblemContext'; // ★ useProblem をインポート

interface ProblemData {
  id: string; // ★ API から返る問題IDが string であれば string に（現状はnumberの想定かもしれないので注意）
  question: string;
  // userAnswer?: number | null; // ユーザー解答や正誤はここでは管理しない想定
  // isCorrect?: boolean;
  // type?: string;
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
const saveCompletionData = (difficulty: DifficultyRank, user: UserData | null) => {
  if (!user || !user.username) { // ユーザー情報とユーザー名があるか確認
    console.warn('[saveCompletionData] User or username is missing, cannot save completion.');
    return; 
  }

  try {
    const completionData = localStorage.getItem('mathChallengeCompletion') || '[]';
    const parsedData = JSON.parse(completionData);

    parsedData.push({
      date: getDateString(),
      difficulty,
      username: user.username, // ★ 引数の user から username を使用
      timestamp: new Date().toISOString()
    });
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
  const [currentProblems, setCurrentProblems] = useState<ProblemData[]>([]); // 型明示
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
  const [isCountingDown, setIsCountingDown] = useState(false); // ★ カウントダウン中 state 追加
  const [selectedDate, setSelectedDate] = useState<string>(() => getFormattedDate(new Date())); // ★ より確実に今日の日付を初期化
  // ★ 初期値の確認ログを追加
  useEffect(() => {
    console.log('[Problems] Initial selectedDate:', selectedDate);
    console.log('[Problems] Today formatted date:', getFormattedDate(new Date()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回レンダリング時のみ実行
  const { count: remainingTime, startCountdown } = usePreciseCountdown(300);
  const { finalizeSession } = useProblem(); // ★ finalizeSession を使用

  // Load user data and token from localStorage
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('user'); 
    const storedToken = localStorage.getItem('token');
    if (storedUserInfo && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUserInfo) as UserData; 
        if (!parsedUser._id) {
          console.warn("[Problems Page] User data from localStorage is missing '_id'. Data:", parsedUser);
        }
        setCurrentUser({ 
          ...parsedUser, 
          token: storedToken
        });
      } catch (e) {
        console.error("Failed to parse user info from localStorage", e);
        setCurrentUser(null);
      }
    } else {
       setCurrentUser(null); 
    }
  }, []);

  // カウントダウン完了時の処理を定義 (useCallbackでメモ化)
  const handleCountdownComplete = useCallback(() => {
    console.log("Countdown complete, starting game!");
    setIsStarted(true);      // ゲーム開始状態にする
    setIsCountingDown(false); // ★ カウントダウン終了
    setStartTime(Date.now()); // 開始時間を記録
    setElapsedTime(0);      // 経過時間リセット
    // 最初の問題にフォーカス
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, []); // 依存配列に setIsCountingDown を追加 (念のため)

  // 作成したカスタムフックを使用
  const { count: currentCountdownValue, startCountdown: countdownStart } = usePreciseCountdown(1000, handleCountdownComplete);

  // ★ カウントダウン表示のエフェクト
  useEffect(() => {
    if (currentCountdownValue === 0) {
      setShowStart(true);
      // 0.3秒後に非表示にする（従来の0.7秒から短縮）
      const timer = setTimeout(() => {
        setShowStart(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentCountdownValue]);

  // ★ handleStart を修正 - 時間チェックを追加
  const handleStart = () => {
    if (currentProblems.length === 0) {
        setError("問題がロードされていません。リフレッシュしてください。");
      return;
    }
    
    // 時間チェック（管理者は除外）
    const isAdmin = currentUser?.isAdmin === true;
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isAdmin && !isDevelopment) {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hours + minutes/60;
      
      // 時間制限チェック: 朝6:30-8:00のみ利用可能
      if (currentTime < 6.5 || currentTime > 8.0) {
        setError('計算チャレンジは、朝6:30から8:00の間のみ挑戦できます！');
        return;
      }
    }
    
    console.log("開始ボタンがクリックされました - カウントダウン開始");
    // エラーをクリア
    setError(null);
    setIsCountingDown(true); // ★ カウントダウン開始 state にする
    countdownStart(3); // ★ 引数に初期値 (3) を渡す
    console.log('Countdown started by handleStart with 3');
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
    if (currentIndex >= currentProblems.length) {
      return; // すでに最後の問題
    }

    // 現在の回答を保存
    const newAnswers = [...answers];
    newAnswers[currentIndex] = currentAnswer;
    setAnswers(newAnswers);

    // 次の問題へ
    if (currentIndex < currentProblems.length - 1) {
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
    if (currentIndex < currentProblems.length) {
      const newAnswers = [...answers];
      newAnswers[currentIndex] = currentAnswer;
      setAnswers(newAnswers);
    }
  };

  // ★ handleComplete をサーバー送信ロジックに変更
  const handleComplete = async (finalAnswers: string[]) => {
    console.log('[Problems] handleComplete CALLED. startTime:', startTime, 'isStarted:', isStarted); // ★デバッグログ追加
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    const endTime = Date.now();
    const safeStartTime = startTime ?? endTime; // startTimeがnullならendTimeで補完
    const timeTaken = safeStartTime ? endTime - safeStartTime : 0;

    // ユーザー情報を取得（ローカルストレージから）
    const storedUser = localStorage.getItem('user');
    const userId = storedUser ? (JSON.parse(storedUser) as UserData)._id : 'unknown_user';

    // デバッグログ
    console.log('[Problems] handleComplete called.');
    console.log('[Problems] Submitting with:', {
      difficulty: difficulty,
      date: selectedDate, // ★ 選択された日付を使用
      problemIds: currentProblems.map((p: ProblemData) => p.id),
      answers: finalAnswers,
      timeSpentMs: timeTaken, 
      userId: userId
    });

    try {
      // problemsAPI.submitAnswers を呼び出し
      const response = await problemsAPI.submitAnswers({
        difficulty: difficulty,
        date: selectedDate, // ★ 選択された日付を使用
        problemIds: currentProblems.map((p: ProblemData) => p.id),
        answers: finalAnswers,
        timeSpentMs: timeTaken, // timeSpent → timeSpentMs に修正
        userId: userId
      });
      
      console.log('[Problems] API submitAnswers response:', response);

      if (response && response.success && response.results) { // ★ .result を .results に変更
        // サーバーからの実績値を取得
        const apiResultFromServer = response.results; // ★ .result を .results に変更

        // ★★★ デバッグログ追加: APIレスポンス全体と、Resultsに渡すデータ ★★★
        console.log('[Problems.tsx] Full API response:', JSON.stringify(response, null, 2));
        console.log('[Problems.tsx] Data passed to onComplete (apiResultFromServer):', JSON.stringify(apiResultFromServer, null, 2));
        // ★★★ デバッグログここまで ★★★

        // ProblemContext の finalizeSession を呼び出し、サーバーからの結果を渡す
        // apiResultFromServer は ApiResultData 型と想定される。
        // ApiResultData には problems というフィールドがあり、これが ProblemResult[] 型。
        // finalizeSession の第一引数は ProblemResult[] を期待している。
        finalizeSession(apiResultFromServer.problems, apiResultFromServer);

        // ローカルストレージに完了情報を保存
        saveCompletionData(difficulty, currentUser);
        onComplete(response.results); // onComplete には response.results (結果データ本体) を渡す
      } else {
        console.error('[Problems] Answer submission failed or unexpected response:', response);
        setError(response?.message || '回答の送信に失敗しました。データ形式を確認してください。');
        // finalizeSession を呼ぶべきか検討。エラー時は呼ばない方が良いかもしれない。
        // あるいは、エラー用のセッション終了処理を設ける。
        // ここでは、エラー時は古い endSession のような形で、フロントエンド時間でセッションを終了する想定はしない。
      }
    } catch (error) {
      console.error('[Problems] Error submitting answers:', error);
      if (isAxiosError(error) && error.response) {
        setError(error.response.data.message || '回答の送信中にエラーが発生しました。');
      } else {
        setError('回答の送信中に不明なエラーが発生しました。');
      }
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
        // ★ 日付変更時にキャッシュもクリア
        const cacheKey = `problems_${difficulty}_${newDate}`;
        sessionStorage.removeItem(cacheKey);
        console.log('[Problems] Cache cleared due to date change');
    } else {
        console.warn("Invalid date format selected:", newDate);
    }
  };

  // ★ キャッシュクリア関数を追加
  const clearCache = () => {
    const cacheKey = `problems_${difficulty}_${selectedDate}`;
    sessionStorage.removeItem(cacheKey);
    console.log('[Problems] Cache manually cleared');
    // 問題を再読み込み
    window.location.reload();
  };

  // handleSubmitResults
  const handleSubmitResults = useCallback(async (finalResults: ProblemResult) => {
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
      if (isStarted && remainingTime !== null && remainingTime <= 0 && currentProblems.length > 0) { // ★ isStarted を条件に追加
          console.log("Time's up!");
          // タイムアウトした場合も handleComplete を呼び出す
          // その時点での回答状況 (answers) を渡す
          handleComplete(answers); // ★ calculateResults の代わりに handleComplete を呼ぶ
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingTime, isStarted, currentProblems, answers, handleComplete]); // ★ 依存配列に isStarted, handleComplete を追加し、不要なものを削除

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
      setError(null);
      if (!currentUser || !currentUser._id) {
        console.error('[Problems] loadProblems: currentUser or currentUser._id is missing.');
        setIsLoading(false);
        return;
      }
      setIsLoading(true); 
      console.log(`[Problems] Loading problems for user: ${currentUser._id}, difficulty: ${difficulty}, date: ${selectedDate}`);

      const cacheKey = `problems_${difficulty}_${selectedDate}`;
      
      // ★ 開発モードでは常にキャッシュをクリアして最新データを取得
      if (import.meta.env.DEV) {
        console.log('[Problems] Development mode: clearing cache to fetch latest data');
        sessionStorage.removeItem(cacheKey);
      }
      
      const cachedProblems = sessionStorage.getItem(cacheKey);
      
      try {
        if (cachedProblems && !import.meta.env.DEV) { // 開発モードではキャッシュを使用しない
          try {
            const parsedProblems = JSON.parse(cachedProblems);
            console.log('[Problems Cache] Loaded from cache:', JSON.stringify(parsedProblems.map((p: ProblemData) => p.id), null, 2)); // ★ログ追加、型注釈追加
            setCurrentProblems(parsedProblems);
            setIsLoading(false);
            return;
          } catch (parseError) {
            console.warn('問題キャッシュの解析に失敗しました:', parseError);
          }
        }

        // ★ currentUser から直接 _id を使用する (getUserData() の呼び出しを削除)
        if (!currentUser._id) { // このチェックは上記のガード節でカバーされているが念のため
          throw new Error('ユーザーIDが取得できません。再ログインしてください。');
        }
        const currentUserId = currentUser._id; 
        
        console.log(`問題を取得します: 難易度=${difficulty}, 日付=${selectedDate}, ユーザーID=${currentUserId}`);
        
        try {
          const apiResponse = await problemsAPI.getProblems(difficulty, selectedDate);
          console.log('API応答:', apiResponse);
          
          if (apiResponse.success && apiResponse.problems && apiResponse.problems.length > 0) {
            // 問題データを整形
            const formattedProblems = apiResponse.problems.map((problem: any, index: number) => ({
              id: problem.id.toString(),
              question: problem.question,
              type: problem.type || 'mixed'
            }));
            console.log('[Problems API] Loaded from API:', JSON.stringify(formattedProblems.map((p: ProblemData) => p.id), null, 2)); // ★ログ追加、型注釈追加
            
            console.log(`${formattedProblems.length}問の問題を取得しました`);
            setCurrentProblems(formattedProblems);
            
            // 問題をセッションストレージにキャッシュ
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(formattedProblems));
            } catch (cacheError) {
              console.warn('問題キャッシュの保存に失敗しました:', cacheError);
            }
          } else {
            // データが空の場合
            const errorMsg = apiResponse.message || `${selectedDate}の${difficultyToJapanese(difficulty)}問題は見つかりませんでした。`;
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
        setCurrentProblems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProblems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, selectedDate, currentUser]);

  // ★ 経過時間タイマー (これは isStarted をトリガーにするので変更なし)
  useEffect(() => {
    console.log('[Problems] elapsedTime useEffect. isStarted:', isStarted, 'startTime:', startTime); // ★デバッグログ追加
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
    if (isStarted && currentIndex < currentProblems.length) {
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
  }, [currentIndex, isStarted, currentProblems.length, answers]);

  // --- レンダリングロジック ---
  
  if (isLoading) {
    // ★ ローディング表示はシンプルに
    return <div className="text-center p-10"><ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</div>;
  }

  // ★ エラー or 完了済みの場合は専用表示 (日付選択は含めない)
  if (error) { // alreadyCompleted も error ステートにメッセージを設定するようになったはず
      return (
          <div className="text-center p-10">
              <p className="mb-4 text-red-500">{error}</p>
              <button onClick={() => window.location.reload()} className="button button-secondary">ページ<ruby>再読<rt>さいよ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み</button>
          </div>
      );
  }

  // Handle case where user info is still loading
  if (currentUser === undefined) {
      return <div className="problems-container">ユーザー<ruby>情報<rt>じょうほう</rt></ruby>を<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>...</div>; 
  }

  // --- 通常の表示フロー --- 
  return (
    // ★ problems-container クラスをトップレベルに (以前の構造に近い想定)
    <div className="problems-container card max-w-2xl mx-auto p-4 md:p-6">

      {/* ヘッダー情報: ログインユーザー、難易度、日付 */} 
      <div className="flex justify-between items-center mb-4 text-sm">
         {currentUser && (
            <div className="text-gray-600">
               <ruby>現在<rt>げんざい</rt></ruby>のユーザー: <span className="font-bold">{currentUser.username}</span>
               {/* ★ 開発モードでキャッシュクリアボタンを表示 */}
               {import.meta.env.DEV && (
                 <button 
                   onClick={clearCache}
                   className="ml-4 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                   title="キャッシュをクリアして最新の問題を取得"
                 >
                   🗑️ キャッシュクリア
                 </button>
               )}
            </div>
         )}
         {/* 日付選択を追加 (右上に配置するイメージ) */} 
         <div className="date-selector text-right">
             <label htmlFor="problem-date" className="mr-2"><ruby>日付<rt>ひづけ</rt></ruby>:</label>
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
          {currentProblems.length === 0 && !isLoading && !error && (
             <div className="mb-6">
               <p className="text-red-500 mb-4">
                 <ruby>選択<rt>せんたく</rt></ruby>された<ruby>日付<rt>ひづけ</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>が<ruby>見<rt>み</rt></ruby>つかりませんでした。
               </p>
               {currentUser?.isAdmin && (
                 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                   <p className="text-blue-700 mb-2">
                     <ruby>管理者<rt>かんりしゃ</rt></ruby>として<ruby>問題<rt>もんだい</rt></ruby>を<ruby>生成<rt>せいせい</rt></ruby>できます:
                   </p>
                   <a 
                     href="/admin/generate" 
                     className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                   >
                     <ruby>問題生成<rt>もんだいせいせい</rt></ruby>ページへ
                   </a>
                 </div>
               )}
             </div>
          )}
          {/* 問題がある場合 */}
          {currentProblems.length > 0 && (
            <>
              <p className="mb-6">
                {currentProblems.length}<ruby>問<rt>もん</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>に<ruby>挑戦<rt>ちょうせん</rt></ruby>します。<br/>
                できるだけ<ruby>早<rt>はや</rt></ruby>く、<ruby>正確<rt>せいかく</rt></ruby>に<ruby>解<rt>と</rt></ruby>きましょう！
              </p>
              {/* カウントダウン表示エリア */} 
              {isCountingDown && currentCountdownValue !== null && currentCountdownValue > 0 && (
                <div className="countdown-display fade-in-out">
                  {currentCountdownValue} 
                </div>
              )}
              {/* 「スタート！」表示エリア */} 
              {showStart && (
                <div className="start-signal">スタート！</div>
              )}
              {/* 開始ボタン (カウントダウン中は表示しない) */} 
              {!isCountingDown && (
                 <button
                   onClick={handleStart}
                   className="button button-primary button-large"
                   disabled={isLoading} // ローディング中は無効
                 >
                   <ruby>開始<rt>かいし</rt></ruby>する
                 </button>
              )}
            </>
          )}
          {/* 常に表示されるホームボタン */}
          <button onClick={onBack} className="button button-secondary mt-4">もどる</button>
        </div>
      )}

      {/* ゲーム中の表示 (isStarted が true) */}
      {isStarted && currentProblems.length > 0 && currentIndex < currentProblems.length && (
        // ★ 以前の problem-view に相当する構造を再現
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* プログレスバーとタイマー */} 
          <div className="flex justify-between items-center mb-6 text-lg font-medium">
            <div>
              <ruby>問題<rt>もんだい</rt></ruby> {currentIndex + 1} / {currentProblems.length}
            </div>
            <div className="text-primary-600">
              <ruby>経過時間<rt>けいかじかん</rt></ruby>: {formatTime(elapsedTime)}
            </div>
          </div>

          {/* 問題文 */} 
          <div className="problem-text text-3xl font-bold text-center mb-8">
            {currentProblems[currentIndex].question}
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
              placeholder="こたえをにゅうりょく"
              autoFocus // ゲーム開始時にフォーカス
            />
            {/* ナビゲーションボタン */} 
            <div className="navigation-buttons flex justify-center gap-4 w-full">
                <button
                  onClick={handleBack}
                  className="button button-secondary"
                  disabled={currentIndex === 0}
                >
                  もどる
                </button>
                <button
                  onClick={handleNext}
                  className="button button-primary"
                >
                  {currentIndex === currentProblems.length - 1 ? (
                    <ruby>完了<rt>かんりょう</rt></ruby>
                  ) : (
                    <span><ruby>次<rt>つぎ</rt></ruby>へ</span>
                  )}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Problems;