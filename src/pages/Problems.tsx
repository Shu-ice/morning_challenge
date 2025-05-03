import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Problems.css';
import { useNavigate } from 'react-router-dom';
// import type { Problem, Results, UserData } from '@/types'; // 古いインポートをコメントアウト
// import type { ProblemResult } from '@/types/index'; // 古いインポートをコメントアウト
import type { Problem, ProblemResult, Results, UserData } from '@/types/index'; // index.ts からまとめてインポート
import { generateProblems } from '@/utils/problemGenerator';
import { DifficultyRank, difficultyToJapanese } from '@/types/difficulty';
import { usePreciseCountdown } from '@/hooks/usePreciseCountdown';
// import axios from 'axios';  // axiosのインポートをコメントアウト

interface ProblemData {
  id: number;
  question: string;
  answer?: number;
  userAnswer?: number | null;
  isCorrect?: boolean;
  type?: string;
}

interface ProblemsProps {
  difficulty: DifficultyRank;
  onComplete: (results: Results) => void;
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
    const userDataString = localStorage.getItem('userData');
    return userDataString ? JSON.parse(userDataString) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

// 完了情報をチェック (ユーザー名を考慮)
const hasCompletedTodaysProblems = (difficulty: DifficultyRank) => {
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

export default function Problems({ difficulty, onComplete }: ProblemsProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<ProblemData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [rank, setRank] = useState<number | null>(null); // 結果表示用だが、Problemsページでは直接不要かも
  const [currentUser, setCurrentUser] = useState<UserData | null>(getUserData());
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); // input要素への参照
  const [showStart, setShowStart] = useState(false);

  // カウントダウン完了時の処理を定義 (useCallbackでメモ化)
  const handleCountdownComplete = useCallback(() => {
    console.log("Countdown complete, starting game!");
    setIsStarted(true);      // ゲーム開始状態にする
    setStartTime(Date.now()); // 開始時間を記録
    setElapsedTime(0);      // 経過時間リセット
    // この時点で currentCountdownValue は 0 になっているはず
  }, []); // 依存配列は空でOK (setIsStartedなどは安定している想定)

  // 作成したカスタムフックを使用
  const { count: currentCountdownValue, startCountdown } = usePreciseCountdown(1000, handleCountdownComplete);

  // 問題ロードと完了チェック
  useEffect(() => {
    // ★ ユーザーが取得できない場合はログインページなどにリダイレクトする方が親切かも
    if (!currentUser) {
        setError("ログイン情報が見つかりません。ログインし直してください。");
        setLoading(false);
        // navigate('/login'); // 例：ログインページへ遷移
        return;
    }

    if (hasCompletedTodaysProblems(difficulty)) {
      setAlreadyCompleted(true);
      // ユーザー名をメッセージに追加
      setError(`${currentUser.username}さんは、今日はすでに${difficultyToJapanese(difficulty)}の問題に取り組みました。明日また挑戦してください！`);
      setLoading(false);
      return;
    }

    const loadProblems = () => {
      try {
        setLoading(true);
        console.log(`Loading problems for difficulty: ${difficulty}`);
        const newProblems = generateProblems(difficulty);
        console.log(`Generated ${newProblems.length} problems.`);
        
        // Problem型をProblemData型に変換
        const problemsData: ProblemData[] = newProblems.map((p, index) => ({
          id: index,
          question: p.question,
          answer: p.answer,
          type: 'math'
        }));
        
        setProblems(problemsData);
        setAnswers(new Array(newProblems.length).fill('')); // 回答配列を初期化
        setError(null); // エラーをクリア
      } catch (err) {
        console.error('Failed to generate problems:', err);
        setError('問題の生成に失敗しました。ページを再読み込みしてください。');
        setProblems([]); // 問題リストを空にする
      } finally {
        setLoading(false);
      }
    };
    
    loadProblems();
  }, [difficulty, currentUser]);

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

  // currentCountdownValueが0になったらshowStartをtrueにし、一定時間後にfalseに戻す
  useEffect(() => {
    if (currentCountdownValue === 0) {
      setShowStart(true);
      // 0.7秒後に非表示にする (以前は1.5秒)
      const timer = setTimeout(() => {
        setShowStart(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [currentCountdownValue]);

  // ★ handleStart を修正
  const handleStart = () => {
    if (problems.length > 0) {
      // フックの startCountdown を呼び出して開始
      startCountdown(3);
    } else {
        setError("問題がロードされていません。リフレッシュしてください。");
    }
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
    if (currentIndex >= problems.length) return; // 念のため

    const newAnswers = [...answers];
    newAnswers[currentIndex] = currentAnswer; // 現在の入力値を保存
    setAnswers(newAnswers);

    if (currentIndex < problems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentAnswer(''); // 次の問題のためにクリア
    } else {
      // 最後の問題だったので完了処理
      handleComplete(newAnswers); // 最新の回答配列を渡す
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

  // 「戻る」ボタンのハンドラ
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

  const handleComplete = (finalAnswers: string[]) => {
    if (timerRef.current) {
        clearInterval(timerRef.current); // タイマー停止
    }
    setIsStarted(false); // 開始状態を解除
    const finalElapsedTime = startTime ? Date.now() - startTime : elapsedTime; // 最終的な経過時間
    console.log("Completing quiz...");

    // 問題ごとの結果を作成
    const problemResults: ProblemResult[] = problems.map((problem, index) => {
      const userAnswerStr = finalAnswers[index];
      const userAnswerNum = userAnswerStr === '' ? null : parseFloat(userAnswerStr); // 空はnull、それ以外は数値に
      const isCorrect = userAnswerNum !== null && problem.answer !== undefined && userAnswerNum === problem.answer;
      
      // 個々の問題の所要時間は現状では計測していないため、一旦 0 を設定
      // 必要であれば、各問題の回答時にタイムスタンプを記録するロジックを追加
      const timeSpentPerProblem = 0; 

      return {
        id: index, // ★ index を id として使用
        question: problem.question,
        userAnswer: userAnswerNum,
        correctAnswer: problem.answer || 0, // undefinedの場合は0をフォールバックとして使用
        isCorrect: isCorrect,
        timeSpent: timeSpentPerProblem,
      };
    });

    // 正解数を計算
    const correctAnswers = problemResults.filter(result => result.isCorrect).length;
    const totalProblems = problems.length;
    const incorrectAnswers = totalProblems - correctAnswers;
    const unanswered = finalAnswers.filter(ans => ans === '').length;
    
    // 経過時間を秒に変換 (ミリ秒→秒)
    const timeSpentInSeconds = finalElapsedTime / 1000; // 切り捨てなし
    
    console.log(`Correct answers: ${correctAnswers}/${totalProblems}, Time: ${timeSpentInSeconds.toFixed(2)}秒`);

    // ★ resultsData に明示的に Results 型を指定
    const resultsData: Results = {
      totalProblems: totalProblems,
      correctAnswers: correctAnswers,
      incorrectAnswers: incorrectAnswers,
      unanswered: unanswered,
      totalTime: finalElapsedTime,
      timeSpent: timeSpentInSeconds, // 秒単位の経過時間（切り捨てなし）
      problems: problemResults,
      difficulty: difficulty,
      score: calculateScore(correctAnswers, totalProblems, finalElapsedTime),
      grade: currentUser?.grade || 0,
      // rank は addToRankings で設定される
    };

    // 完了情報を保存 (ユーザー名を考慮する修正済み)
    saveCompletionData(difficulty);

    // ランキングに結果を追加
    addToRankings(resultsData);

    // --- 履歴保存処理 (コメント解除 & ユーザー考慮) ---
    try {
      if (currentUser) { // ★ ログインユーザーがいる場合のみ保存
        const historyKey = `user_history_${currentUser.username}`; // ★ ユーザー固有のキー
        const historyData = localStorage.getItem(historyKey) || '[]';
        const parsedHistory: any[] = JSON.parse(historyData);
        
        parsedHistory.push({ // resultsData に timestamp を追加して保存
          ...resultsData,
          timestamp: new Date().toISOString() 
        });

        // 古い履歴を削除する場合 (例: 最新50件のみ保持)
        const maxHistory = 50;
        if (parsedHistory.length > maxHistory) {
          parsedHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          parsedHistory.splice(maxHistory);
        }

        localStorage.setItem(historyKey, JSON.stringify(parsedHistory));
        console.log(`User history saved for ${currentUser.username}.`);
      } else {
         console.warn("User data not found, history not saved.");
      }
    } catch (error) {
      console.error("Failed to save user history:", error);
    }
    // --- 履歴保存処理ここまで ---

    // コールバックで結果を渡す
    onComplete(resultsData);
  };

  // ランキングに結果を追加する関数
  const addToRankings = (results: Results) => {
    try {
      if (!currentUser) return; // ユーザーがいない場合は何もしない
      
      // 既存のランキングを取得
      const rankingsData = localStorage.getItem('rankings') || '[]';
      let rankings = JSON.parse(rankingsData);
      
      // 新しいランキング項目を作成
      const newRankingItem = {
        ...results,
        timestamp: new Date().toISOString(),
        username: currentUser.username,
        grade: currentUser.grade || '不明'
      };
      
      // ランキングに追加
      rankings.push(newRankingItem);
      
      // 難易度でフィルタリングし、正解数と時間でソート
      const sortedRankings = rankings
        .filter((r: any) => r.difficulty === results.difficulty)
        .sort((a: any, b: any) => {
          if (a.correctAnswers !== b.correctAnswers) {
            return b.correctAnswers - a.correctAnswers;
          }
          return a.timeSpent - b.timeSpent;
        });
      
      // 現在の結果の順位を計算
      const rank = sortedRankings.findIndex((r: any) => 
        r.timestamp === newRankingItem.timestamp && 
        r.username === newRankingItem.username
      ) + 1;
      
      // 順位を結果に追加
      newRankingItem.rank = rank;
      
      // 上位20件だけ保持するフィルタリングを各難易度ごとに行う
      const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
      let filteredRankings: any[] = [];
      
      difficulties.forEach(diff => {
        // ここで rankings を直接フィルタリングする
        const diffRankings = rankings.filter((r: any) => r.difficulty === diff);
        const topRankings = diffRankings
          .sort((a: any, b: any) => {
            if (a.correctAnswers !== b.correctAnswers) {
              return b.correctAnswers - a.correctAnswers;
            }
            return a.timeSpent - b.timeSpent;
          })
          .slice(0, 20);
        
        filteredRankings = [...filteredRankings, ...topRankings];
      });
      
      // 更新したランキングを保存
      localStorage.setItem('rankings', JSON.stringify(filteredRankings));
      console.log(`Ranking updated. Current rank: ${rank}`);
      
      // 結果に順位を追加
      setRank(rank);
    } catch (error) {
      console.error("Failed to update rankings:", error);
    }
  };
  
  // ランキング計算関数 (Resultsページに移動しても良い)
  const calculateRank = (correctCount: number, timeSpent: number, difficulty: DifficultyRank): number => {
    try {
        const rankingsJson = localStorage.getItem('rankings') || '[]';
        let rankings = JSON.parse(rankingsJson);
        rankings = rankings.filter((r: any) => r.difficulty === difficulty);
        rankings.sort((a: any, b: any) => {
          if (a.correctAnswers !== b.correctAnswers) {
            return b.correctAnswers - a.correctAnswers;
          }
          return a.timeSpent - b.timeSpent;
        });
        for (let i = 0; i < rankings.length; i++) {
          if (correctCount > rankings[i].correctAnswers ||
              (correctCount === rankings[i].correctAnswers && timeSpent < rankings[i].timeSpent)) {
            return i + 1;
          }
        }
        return rankings.length + 1;
    } catch(e) {
        console.error("Failed to calculate rank", e);
        return 0; // エラー時は0位など
    }
  };
  
  // 時間フォーマット関数 (秒単位、小数点以下2桁)
  const formatTime = (milliseconds: number) => {
    const totalSeconds = milliseconds / 1000;
    // 小数点以下は常に2桁表示
    return `${totalSeconds.toFixed(2)}秒`;
  };

  // --- レンダリングロジック ---
  
  if (loading) {
    return <div className="text-center p-10">問題を読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-10">
        <p className="mb-4 text-red-500">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="button button-secondary"
        >
          トップに戻る
        </button>
      </div>
    );
  }
  
  // 開始前画面 (currentCountdownValue が null の場合)
  if (!isStarted && currentCountdownValue === null) {
    return (
      <div className="text-center p-10">
        {currentUser && (
          <div className="mb-4 text-gray-600">
            ログイン中: <span className="font-bold">{currentUser.username}</span>
          </div>
        )}
        <h2 className="text-2xl font-bold mb-4">準備はいいですか？</h2>
        <p className="mb-6">
          {problems.length}問の{difficultyToJapanese(difficulty)}問題に挑戦します。<br/>
          できるだけ早く、正確に解きましょう！
        </p>
        <button
          onClick={handleStart}
          className="button button-primary button-large"
          disabled={problems.length === 0 || alreadyCompleted}
        >
          開始する
        </button>
      </div>
    );
  }
  
  // カウントダウン中 & ゲーム開始前 (currentCountdownValue が 1以上)
  if (currentCountdownValue !== null && currentCountdownValue > 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-9xl font-bold countdown-number animate-pulse">
          {currentCountdownValue}
        </div>
        <div className="mt-4 text-xl text-gray-600">
          準備してください...
        </div>
      </div>
    );
  }
  
  // カウントダウン完了 (0) または ゲーム中 (isStarted)
  // currentCountdownValue が 0 になった瞬間もここに該当し、handleCountdownComplete が呼ばれて isStarted が true になる
  if (isStarted || currentCountdownValue === 0) {
    const currentProblem = problems[currentIndex];
    // currentProblem が undefined の可能性を考慮 (問題が空の場合など)
    if (!currentProblem) {
        return <div className="text-center p-10">問題データを読み込めませんでした。</div>;
    }
    
    return (
      <div className="problems-container max-w-2xl mx-auto p-4 md:p-6">
         {/* currentCountdownValue が 0 の時だけ「スタート！」を表示 */} 
         {showStart && (
           <div className="fixed inset-0 flex items-center justify-center z-10 pointer-events-none">
             <div className="text-9xl font-bold countdown-start animate-bounce">
               スタート!
             </div>
           </div>
         )}

        {/* 問題表示エリア (常に表示される) */} 
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6 text-lg font-medium">
            <div>
              問題 {currentIndex + 1} / {problems.length}
            </div>
            <div className="text-primary-600">
              {/* ゲーム開始前 (countdown=0) は経過時間0、開始後は elapsedTime を表示 */} 
              経過時間: {formatTime(isStarted ? elapsedTime : 0)}
            </div>
          </div>

          {currentUser && (
            <div className="text-right text-sm text-gray-500 mb-4">
              ログイン中: <span className="font-medium">{currentUser.username}</span>
            </div>
          )}

          <div className="problem-text text-3xl font-bold text-center mb-8">
            {currentProblem.question} 
            </div>
            
          <div className="answer-section flex flex-col items-center justify-center">
              <input
              ref={inputRef}
              id="answer-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={currentAnswer}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onWheel={(e) => e.preventDefault()} 
              className="answer-input w-full max-w-xs p-3 text-xl text-center border-2 border-gray-300 rounded-md focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition duration-150 ease-in-out mb-6"
              placeholder="答えを入力"
              // ゲーム開始後に自動フォーカス
              autoFocus={isStarted} 
              />
            <div className="navigation-buttons flex justify-center gap-4 w-full">
                <button 
                onClick={handleBack}
                className="button button-secondary"
                disabled={currentIndex === 0 || !isStarted} // ゲーム開始前は無効
                >
                  戻る
                </button>
                <button 
                onClick={handleNext}
                className="button button-primary"
                disabled={!isStarted} // ゲーム開始前は無効
                >
                {currentIndex === problems.length - 1 ? '完了' : '次へ'}
                </button>
              </div>
            </div>
      </div>
    </div>
    );
  }

  // 通常はここに到達しないはず
  return <div className="text-center p-10">予期せぬ状態です...</div>;
}