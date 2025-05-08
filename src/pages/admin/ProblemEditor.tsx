import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { DifficultyRank, difficultyToJapanese } from '@/types/difficulty';

// 利用可能な難易度の配列
const availableDifficulties: DifficultyRank[] = ['beginner', 'intermediate', 'advanced', 'expert'];

interface EditableProblem {
  id: number;
  question: string;
  correctAnswer: number;
  options?: number[];
  isEditing?: boolean;
  editedQuestion?: string;
  editedCorrectAnswer?: string;
}

const ProblemEditor: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [problems, setProblems] = useState<EditableProblem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 問題の読み込み関数
  const loadProblems = async () => {
    // ★ 関数が呼ばれたことを確認するログ
    console.log('[ProblemEditor] loadProblems function called.'); 
    try {
      setIsLoading(true);
      setError(null);
      setMessage(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('認証トークンが見つかりません。ログインし直してください。');
        setIsLoading(false);
        return;
      }

      // APIのベースURLを取得
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5003/api';
      
      const response = await axios.get(`${baseUrl}/problems/edit`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { date: selectedDate, difficulty: selectedDifficulty },
        timeout: 30000 // 30秒タイムアウトに延長
      });

      // ★★★ APIからのレスポンス全体をログに出力 ★★★
      console.log('[ProblemEditor] Full API Response Data:', response.data);

      if (response.data.success) {
        if (response.data.data && Array.isArray(response.data.data)) {
          // ★★★ APIからの応答データをログに出力 (dataキーを使用) ★★★
          console.log('[ProblemEditor] API Response Data (data):', response.data.data);
          
          setProblems(response.data.data.map((p: any) => ({
          ...p,
            id: p._id || p.id, 
            correctAnswer: p.answer !== undefined ? Number(p.answer) : undefined, // answerを数値に変換、存在しない場合考慮
            question: p.question,
          isEditing: false
            // optionsも必要ならここでマッピング p.options
        })));
          // messageではなく、成功時は一旦空にするか、件数表示のみにする
          // setMessage(`${response.data.data.length}件の問題を読み込みました。`); 
          setMessage(null); // エラーがなければメッセージはクリア
          setError(null); // エラーもクリア
        } else {
          // success: true だが data がない/配列でない場合
          setError('問題データの形式が正しくありません。');
          setProblems([]);
        }
      } else {
        // success: false の場合
        setError(response.data.message || '問題の取得に失敗しました。');
        setProblems([]);
      }
    } catch (err: any) {
      console.error('Problem loading error:', err);
      // デバッグログを追加
      if (err.code) console.error('Error code:', err.code);
      if (err.message) console.error('Error message:', err.message);
      if (err.stack) console.error('Error stack:', err.stack);
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          if (err.response.status === 404) {
            setError(`この日付・難易度の問題は存在しません。先に問題生成ツールで作成してください。`);
          } else {
            setError(`サーバーエラー (${err.response.status}): ${err.response.data?.error || err.response.data?.message || err.message}`);
          }
        } else if (err.request) {
          setError(`サーバーに接続できませんでした。タイムアウトまたはネットワーク問題の可能性があります。\nエラー: ${err.message || 'タイムアウト'}`);
        } else {
          setError(`リクエストエラー: ${err.message}`);
        }
      } else {
        setError(`問題の取得中に予期せぬエラーが発生しました: ${err.message || 'Unknown error'}`);
      }
      setProblems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 編集モード切替
  const toggleEditMode = (id: number) => {
    setProblems(prev => prev.map(p => 
      p.id === id 
        ? { 
            ...p, 
            isEditing: !p.isEditing, 
            editedQuestion: p.isEditing ? undefined : p.question, 
            editedCorrectAnswer: p.isEditing ? undefined : String(p.correctAnswer)
          }
        : p
    ));
    setError(null);
    setMessage(null);
  };

  // 編集内容のハンドル
  const handleEditChange = (id: number, field: 'question' | 'correctAnswer', value: string) => {
    setProblems(prev => prev.map(p => 
      p.id === id 
        ? { 
            ...p, 
            [field === 'question' ? 'editedQuestion' : 'editedCorrectAnswer']: value 
          } 
        : p
    ));
  };

  // 問題を保存する関数
  const saveProblems = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('認証トークンが見つかりません。ログインし直してください。');
        setIsSaving(false);
        return;
      }

      // 編集された問題があるか確認
      const hasEditedProblems = problems.some(p => p.isEditing);
      if (hasEditedProblems) {
        setError('保存前に編集中の問題を確定してください。');
        setIsSaving(false);
        return;
      }

      // APIのベースURLを取得
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5003/api';
      
      const response = await axios.post(`${baseUrl}/problems/edit`, {
        date: selectedDate,
        difficulty: selectedDifficulty,
        problems: problems.map(p => ({
          id: p.id,
          question: p.question,
          correctAnswer: p.correctAnswer,
          options: p.options
        }))
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30秒タイムアウトに延長
      });

      if (response.data.success) {
        setMessage(`問題を正常に保存しました。件数: ${response.data.count || problems.length}件`);
        // ★ キャッシュをクリアする
        const cacheKey = `problems_${selectedDifficulty}_${selectedDate}`;
        sessionStorage.removeItem(cacheKey);
        console.log(`[ProblemEditor] Cleared cache for key: ${cacheKey}`);
      } else {
        setError(response.data.message || '問題の保存に失敗しました。');
      }
    } catch (err: any) {
      console.error('Problem saving error:', err);
      // デバッグログを追加
      if (err.code) console.error('Error code:', err.code);
      if (err.message) console.error('Error message:', err.message);
      if (err.stack) console.error('Error stack:', err.stack);
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          setError(`サーバーエラー (${err.response.status}): ${err.response.data?.error || err.response.data?.message || err.message}`);
        } else if (err.request) {
          setError(`サーバーに接続できませんでした。タイムアウトまたはネットワーク問題の可能性があります。\nエラー: ${err.message || 'タイムアウト'}`);
        } else {
          setError(`リクエストエラー: ${err.message}`);
        }
      } else {
        setError(`問題の保存中に予期せぬエラーが発生しました: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 個別問題の保存
  const handleSaveProblem = (problem: EditableProblem) => {
    if (!problem.editedQuestion || !problem.editedCorrectAnswer) {
      setError('問題と答えを入力してください。');
      return;
    }

    const numericAnswer = Number(problem.editedCorrectAnswer);
    if (isNaN(numericAnswer)) {
      setError('答えは有効な数値である必要があります。');
      return;
    }

    // 問題オブジェクトを更新
    setProblems(prev => prev.map(p => 
      p.id === problem.id 
        ? { 
            ...p, 
            question: problem.editedQuestion as string,
            correctAnswer: numericAnswer,
            isEditing: false,
            editedQuestion: undefined,
            editedCorrectAnswer: undefined
          } 
        : p
    ));
    setError(null);
    setMessage(`問題#${problem.id+1}を更新しました。全ての編集が完了したら「すべての問題を保存」ボタンをクリックしてください。`);
  };

  return (
    <div className="problem-editor-container">
      <h2>問題編集ツール</h2>
      <p>指定した日付と難易度の問題を編集できます。</p>
      
      <div className="filter-form">
        <div className="form-group">
          <label htmlFor="date">日付:</label>
          <input 
            type="date" 
            id="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            required 
          />
        </div>

        <div className="form-group">
          <label htmlFor="difficulty">難易度:</label>
          <select 
            id="difficulty" 
            value={selectedDifficulty} 
            onChange={(e) => setSelectedDifficulty(e.target.value as DifficultyRank)}
            required
          >
            {availableDifficulties.map((rank: DifficultyRank) => (
              <option key={rank} value={rank}>{difficultyToJapanese(rank)}</option>
            ))}
          </select>
        </div>

        <button onClick={loadProblems} disabled={isLoading} className="load-button">
          {isLoading ? '読み込み中...' : '問題を読み込む'}
        </button>
      </div>

      {message && <div className="message success-message">{message}</div>}
      {error && <div className="message error-message">{error}</div>}

      {/* 問題編集領域 */}
      {problems.length > 0 && (
        <div className="problems-container">
          <h3>問題一覧 ({problems.length}件)</h3>
          
          {problems.map((problem, index) => (
            <div key={index} className={`problem-item ${problem.isEditing ? 'editing' : ''}`}>
              <div className="problem-header">
                <span className="problem-number">問題 #{index+1}</span>
                {!problem.isEditing ? (
                  <button onClick={() => toggleEditMode(problem.id)} className="edit-button">
                    編集
                  </button>
                ) : (
                  <div className="edit-buttons">
                    <button 
                      onClick={() => handleSaveProblem(problem)} 
                      disabled={isLoading || isSaving}
                      className="save-button"
                    >
                      保存
                    </button>
                    <button 
                      onClick={() => toggleEditMode(problem.id)} 
                      disabled={isLoading || isSaving}
                      className="cancel-button"
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
              
              <div className="problem-content">
                <div className="problem-field">
                  <label>問題:</label>
                  {problem.isEditing ? (
                    <input 
                      type="text" 
                      value={problem.editedQuestion || ''} 
                      onChange={(e) => handleEditChange(problem.id, 'question', e.target.value)}
                      className="problem-input"
                    />
                  ) : (
                    <div className="problem-value">{problem.question}</div>
                  )}
                </div>
                
                <div className="problem-field">
                  <label>答え:</label>
                  {problem.isEditing ? (
                    <input 
                      type="text" 
                      value={problem.editedCorrectAnswer || ''} 
                      onChange={(e) => handleEditChange(problem.id, 'correctAnswer', e.target.value)}
                      className="answer-input"
                    />
                  ) : (
                    <div className="problem-value">{problem.correctAnswer}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div className="actions">
            <button 
              onClick={saveProblems} 
              disabled={isLoading || isSaving || problems.some(p => p.isEditing)}
              className="save-all-button"
            >
              {isSaving ? '保存中...' : 'すべての問題を保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemEditor; 