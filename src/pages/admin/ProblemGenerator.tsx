import React, { useState, useEffect } from 'react';
import axios from 'axios'; // API通信用
import { format } from 'date-fns'; // 日付フォーマット用
import { DifficultyRank, difficultyToJapanese } from '@/types/difficulty';

// スタイル用のCSSファイルも後で作成想定
// import '@/styles/ProblemGenerator.css'; 

// 利用可能な難易度の配列を定義
const availableDifficulties: DifficultyRank[] = ['beginner', 'intermediate', 'advanced', 'expert'];

// 進捗状況の型定義
interface GenerationStatus {
  status: 'processing' | 'completed' | 'timeout' | 'partial' | 'error';
  progress: number;
  elapsedTime: number;
  startTime: number;
  endTime?: number;
  count?: number;
  error?: string;
}

const ProblemGenerator: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [numberOfProblems, setNumberOfProblems] = useState<number>(10); // デフォルト10問
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState<boolean>(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState<number | null>(null);

  // リクエスト状態を定期的に確認
  useEffect(() => {
    if (requestId && isLoading) {
      // 前回のインターバルがあれば解除
      if (statusCheckInterval) {
        window.clearInterval(statusCheckInterval);
      }
      
      // 新しいインターバルを設定
      const intervalId = window.setInterval(async () => {
        await checkGenerationStatus(requestId);
      }, 2000); // 2秒ごとにチェック
      
      setStatusCheckInterval(intervalId);
      
      // クリーンアップ
      return () => {
        if (intervalId) {
          window.clearInterval(intervalId);
        }
      };
    } else if (!isLoading && statusCheckInterval) {
      // 読み込みが完了したらインターバル停止
      window.clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }
  }, [requestId, isLoading]);

  const checkGenerationStatus = async (id: string) => {
    try {
      // APIのベースURLを取得
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5003/api';
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('認証トークンが見つかりません。ログインし直してください。');
        setIsLoading(false);
        return;
      }

      const response = await axios.get(
        `${baseUrl}/problems/status/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        const generationStatus = response.data.data as GenerationStatus;
        setStatus(generationStatus);
        
        // 状態に応じた処理
        if (['completed', 'timeout', 'partial', 'error'].includes(generationStatus.status)) {
          // 生成完了またはエラー時は読み込み状態を解除
          setIsLoading(false);
          
          if (generationStatus.status === 'completed') {
            setMessage(`問題の生成に成功しました (${selectedDate}, ${difficultyToJapanese(selectedDifficulty)}): ${generationStatus.count}問`);
          } else if (generationStatus.status === 'timeout' || generationStatus.status === 'partial') {
            setMessage(`一部の問題のみ生成されました (${generationStatus.count || 0}問)。詳細: ${generationStatus.status === 'timeout' ? 'タイムアウト' : '部分的に成功'}`);
          } else if (generationStatus.status === 'error') {
            setError(`問題生成中にエラーが発生しました: ${generationStatus.error || '不明なエラー'}`);
          }
          
          // 完了時にリクエストIDをリセット
          setRequestId(null);
        }
      }
    } catch (err) {
      console.error('Status check error:', err);
      // エラー時も読み込み状態を解除
      setIsLoading(false);
      setRequestId(null);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setMessage(null);
    setError(null);
    setStatus(null);
    setRequestId(null);

    try {
      // 認証トークンを取得（localStorage または sessionStorage から）
      const token = localStorage.getItem('token');
      if (!token) {
        setError('認証トークンが見つかりません。ログインし直してください。');
        setIsLoading(false);
        return;
      }

      // APIのベースURLを取得（環境変数から、またはデフォルト値）
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5003/api';
      
      const response = await axios.post(
        `${baseUrl}/problems/generate`,
        {
          date: selectedDate,
          difficulty: selectedDifficulty,
          count: numberOfProblems,
          force: forceUpdate,
          grade: 1 // デフォルト値として1を設定
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30秒タイムアウトに延長（計算量が多い場合に対応）
        }
      );

      if (response.data.success) {
        if (response.data.requestId) {
          // リクエストIDを保存して進捗状況確認を開始
          setRequestId(response.data.requestId);
          setStatus({
            status: 'processing',
            progress: 0,
            startTime: Date.now(),
            elapsedTime: 0
          });
        } else {
          // 従来の即時応答の場合
          setMessage(`${response.data.message || '問題の生成に成功しました。'} (${selectedDate}, ${difficultyToJapanese(selectedDifficulty)})`);
          setForceUpdate(false); // 成功したらforceUpdateをリセット
          setIsLoading(false);
        }
      } else {
        setError(response.data.error || '問題の生成に失敗しました。');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Problem generation error:', err);
      
      // エラーオブジェクトの詳細をログ出力（デバッグ用）
      if (err.code) console.error('Error code:', err.code);
      if (err.message) console.error('Error message:', err.message);
      if (err.stack) console.error('Error stack:', err.stack);
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // サーバーからのエラーレスポンス
          if (err.response.status === 409) {
            setError(`この日付・難易度の問題は既に存在します。上書きする場合は「強制更新」にチェックを入れてください。`);
          } else if (err.response.status === 401) {
            setError(`認証エラー: ログインセッションが無効または期限切れです。再ログインしてください。`);
            // トークンが無効な場合はトークンをクリア
            localStorage.removeItem('token');
          } else {
            setError(`サーバーエラー (${err.response.status}): ${err.response.data?.error || err.response.data?.message || err.message}`);
          }
        } else if (err.request) {
          // リクエストは送信されたがレスポンスがない
          setError(`サーバーに接続できませんでした。タイムアウトの可能性があります。問題数を少なくするか、難易度を下げてみてください。\nエラー: ${err.message || 'タイムアウト'}`);
        } else {
          // リクエスト設定時のエラー
          setError(`リクエストエラー: ${err.message}`);
        }
      } else {
        setError(`問題の生成中に予期せぬエラーが発生しました: ${err.message || 'Unknown error'}`);
      }
      setIsLoading(false);
    }
  };

  // 難易度に応じた最大問題数を決定
  const getMaxProblemsForDifficulty = (difficulty: DifficultyRank): number => {
    switch (difficulty) {
      case 'expert':
        return 10;
      case 'advanced':
        return 20;
      default:
        return 50;
    }
  };

  // 難易度変更時に最大問題数を調整
  const handleDifficultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDifficulty = e.target.value as DifficultyRank;
    setSelectedDifficulty(newDifficulty);
    
    // 現在の問題数が新しい難易度の最大数を超えていた場合、調整
    const maxProblems = getMaxProblemsForDifficulty(newDifficulty);
    if (numberOfProblems > maxProblems) {
      setNumberOfProblems(maxProblems);
    }
  };

  return (
    <div className="problem-generator-container">
      <h2>問題生成ツール</h2>
      <p>指定した日付と難易度の問題を生成し、データベースに保存します。既存の問題がある場合は確認メッセージが表示されます。</p>
      
      <div className="generator-form">
        <div className="form-group">
          <label htmlFor="date">日付:</label>
          <input 
            type="date" 
            id="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            required 
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="difficulty">難易度:</label>
          <select 
            id="difficulty" 
            value={selectedDifficulty} 
            onChange={handleDifficultyChange}
            required
            disabled={isLoading}
          >
            {availableDifficulties.map((rank: DifficultyRank) => (
              <option key={rank} value={rank}>{difficultyToJapanese(rank)}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="count">問題数:</label>
          <input 
            type="number" 
            id="count" 
            value={numberOfProblems} 
            onChange={(e) => setNumberOfProblems(parseInt(e.target.value, 10) || 0)} 
            min="1" 
            max={getMaxProblemsForDifficulty(selectedDifficulty)} 
            required 
            disabled={isLoading}
          />
          <span className="max-problems-info">
            ({`${selectedDifficulty === 'expert' ? '制限: 最大10問' : 
                  selectedDifficulty === 'advanced' ? '制限: 最大20問' : 
                  '最大50問'}`})
          </span>
        </div>

        <div className="form-group">
          <label>
            <input 
              type="checkbox" 
              checked={forceUpdate} 
              onChange={(e) => setForceUpdate(e.target.checked)}
              className="mr-2"
              disabled={isLoading}
            />
            強制更新（既存の問題を上書き）
          </label>
        </div>

        <button 
          onClick={handleGenerate} 
          disabled={isLoading} 
          className="generate-button"
        >
          {isLoading ? '生成中...' : '問題を生成・保存'}
        </button>
      </div>

      {isLoading && status && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
          <div className="progress-info">
            <p>進捗: {Math.round(status.progress)}%</p>
            <p>経過時間: {Math.floor(status.elapsedTime / 1000)}秒</p>
          </div>
        </div>
      )}

      {message && <div className="message success-message">{message}</div>}
      {error && <div className="message error-message">{error}</div>}
      
      {/* 難易度ごとの注意事項 */}
      {selectedDifficulty === 'expert' && (
        <div className="difficulty-warning">
          <h3>Expert難易度についての注意:</h3>
          <p>計算量が多いため、生成に時間がかかる場合があります。タイムアウトが発生した場合は、生成できた問題のみが保存されます。</p>
          <p>最大問題数は10問に制限されています。</p>
        </div>
      )}
    </div>
  );
};

export default ProblemGenerator; 