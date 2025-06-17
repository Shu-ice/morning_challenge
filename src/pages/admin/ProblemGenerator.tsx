import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // API通信用
import { format } from 'date-fns'; // 日付フォーマット用
import { DifficultyRank, difficultyToJapanese } from '@/types/difficulty';
import '@/styles/admin/ProblemGenerator.css';
import type { ApplicationError } from '../../types/error';
import { extractErrorMessage } from '../../types/error';
import { logger } from '@/utils/logger';

// スタイル用のCSSファイルも後で作成想定
// import '@/styles/ProblemGenerator.css'; 

// 利用可能な難易度の配列を定義
const availableDifficulties: DifficultyRank[] = ['beginner', 'intermediate', 'advanced', 'expert'];

// 進捗状況の型定義
interface GenerationStatus {
  status: 'pending' | 'processing' | 'completed' | 'error' | 'timeout';
  message: string;
  progress?: number;
  total?: number;
  problemsGenerated?: number; 
  errorDetails?: string;
  requestId?: string;
  startTime?: number; // UI表示用に経過時間を計算するために追加
  elapsedTime?: string; // UI表示用に経過時間を計算して格納
}

// ★ Propsの型定義を追加
interface ProblemGeneratorProps {
  isActive?: boolean; // オプショナルに変更
}

const ProblemGenerator: React.FC<ProblemGeneratorProps> = ({ isActive = false }) => { // デフォルト値をfalseに設定
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [numberOfProblems, setNumberOfProblems] = useState<number>(10); // デフォルト10問
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState<boolean>(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);

  // ★ マウント・アンマウント、isActive変更時のログ出力useEffect
  useEffect(() => {
    logger.debug(`[ProblemGenerator] useEffect - Component mounted or isActive changed. isActive: ${isActive}`);
    return () => {
      logger.debug('[ProblemGenerator] useEffect - Component unmounted.');
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [isActive, statusCheckInterval]);

  const formatTime = (ms: number | undefined) => {
    if (ms === undefined) return 'N/A';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    return `${minutes}分 ${seconds}秒`;
  };

  const checkGenerationStatus = useCallback(async (currentRequestId: string) => {
    if (!currentRequestId) return;
    try {
      // ★ トークンを取得
      const token = localStorage.getItem('token');
      if (!token) {
        logger.error('[checkGenerationStatus] No token found. Cannot check status.');
        // 必要に応じてエラーメッセージをユーザーに表示
        setMessage('認証エラーが発生しました。再ログインしてください。');
        setIsLoading(false);
        if (statusCheckInterval) clearInterval(statusCheckInterval);
        return;
      }

      // APIのベースURLを取得
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5003/api';
      
      const response = await axios.get(`${baseUrl}/problems/status/${currentRequestId}`, {
        // ★ headers に Authorization を追加
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data: GenerationStatus = response.data.data;
      
      const currentElapsedTime = data.startTime ? formatTime(Date.now() - data.startTime) : 'N/A';

      setStatus(prevStatus => ({
        ...data,
        elapsedTime: currentElapsedTime,
        // progress と total がない場合や、statusによって調整
        progress: data.progress ?? prevStatus?.progress ?? 0,
        total: data.total ?? prevStatus?.total ?? numberOfProblems, 
      }));

      if (data.status === 'completed' || data.status === 'error' || data.status === 'timeout') {
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
        }
        setIsLoading(false);
        setMessage(data.message || (data.status === 'completed' ? '問題生成が完了しました。' : '問題生成中にエラーが発生しました。'));
        if (data.status === 'completed' && data.problemsGenerated) {
            setMessage(prev => `${prev} ${data.problemsGenerated}問がデータベースに保存されました。`);
        }
      }
    } catch (error) {
      logger.error('ステータス確認エラー:', error);
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
      setIsLoading(false);
      setStatus(prev => ({ 
        status: 'error', 
        message: 'ステータス確認中にエラーが発生しました。',
        errorDetails: error instanceof Error ? error.message : String(error),
        requestId: currentRequestId,
        elapsedTime: prev?.elapsedTime || formatTime(prev?.startTime ? Date.now() - prev.startTime : undefined)
      }));
    }
  }, [statusCheckInterval, numberOfProblems]);

  const handleGenerate = async () => {
    // ★ is Active チェック直前のログ
    logger.debug('[ProblemGenerator] handleGenerate - Checking isActive:', isActive);
    // ★ ガード節を追加: 非アクティブなら処理中断
    if (!isActive) {
      logger.warn('[ProblemGenerator.tsx] handleGenerate called but component is not active. Aborting.');
      return;
    }
    
    logger.debug('[ProblemGenerator.tsx] handleGenerate called. Current view might be ProblemEditor.');
    setIsLoading(true);
    setMessage(null);
    setError(null);
    setStatus(null);
    setRequestId(null);
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }

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
          const newRequestIdFromServer = response.data.requestId as string;
          // リクエストIDを保存して進捗状況確認を開始
          setRequestId(newRequestIdFromServer);
          setStatus({
            requestId: newRequestIdFromServer,
            status: 'processing',
            message: response.data.message || '生成処理を開始しました。進捗を確認しています...',
            progress: 0,
            total: numberOfProblems,
            startTime: Date.now(),
            elapsedTime: undefined
          });
          // 進捗確認のインターバルを開始
          if (statusCheckInterval) clearInterval(statusCheckInterval);
          const intervalId = setInterval(() => checkGenerationStatus(newRequestIdFromServer), 2000);
          setStatusCheckInterval(intervalId);
        } else {
          // 従来の即時応答の場合 (requestIdがない場合)
          setMessage(`${response.data.message || '問題の生成に成功しました。'} (${selectedDate}, ${difficultyToJapanese(selectedDifficulty)})`);
          setForceUpdate(false); // 成功したらforceUpdateをリセット
          setIsLoading(false);
        }
      } else {
        setError(response.data.error || '問題の生成に失敗しました。');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      logger.error('Problem generation error:', err);
      
      const error = err as ApplicationError;
      const errorMessage = extractErrorMessage(error);
      
      // より具体的なエラーハンドリング
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // サーバーからのエラーレスポンス
          if (error.response.status === 409) {
            setError(`この日付・難易度の問題は既に存在します。上書きする場合は「強制更新」にチェックを入れてください。`);
          } else if (error.response.status === 401) {
            setError(`認証エラー: ログインセッションが無効または期限切れです。再ログインしてください。`);
            // トークンが無効な場合はトークンをクリア
            localStorage.removeItem('token');
          } else {
            setError(`サーバーエラー (${error.response.status}): ${error.response.data?.error || error.response.data?.message || error.message}`);
          }
        } else if (error.request) {
          // リクエストは送信されたがレスポンスがない
          setError(`サーバーに接続できませんでした。タイムアウトの可能性があります。問題数を少なくするか、難易度を下げてみてください。\nエラー: ${error.message || 'タイムアウト'}`);
        } else {
          // リクエスト設定時のエラー
          setError(`リクエストエラー: ${error.message}`);
        }
      } else {
        setError(errorMessage);
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

  // ★ レンダリング時の isActive ログ
  logger.debug('[ProblemGenerator] Rendering. isActive:', isActive);

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
        <div className="status-container">
          <h4>生成ステータス (ID: {status.requestId})</h4>
          <p>状態: {status.status}</p>
          <p>メッセージ: {status.message}</p>
          {status.progress !== undefined && status.total !== undefined && (
            <div className="progress-bar-container">
              <div 
                className="progress-bar"
                style={{ width: `${(status.progress / (status.total || 1)) * 100}%` }}
              >
                {Math.round((status.progress / (status.total || 1)) * 100)}%
              </div>
            </div>
          )}
          <p>経過時間: {status.elapsedTime || formatTime(status.startTime ? Date.now() - status.startTime : undefined)}</p>
          {status.problemsGenerated !== undefined && <p>生成済み問題数: {status.problemsGenerated}</p>}
          {status.errorDetails && <p className="error-details">詳細: {status.errorDetails}</p>}
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