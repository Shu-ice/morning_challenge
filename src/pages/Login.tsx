import React, { useState } from 'react';
import '../styles/Login.css';
import type { UserData } from '../types/index';
import { authAPI } from '../api/index';

interface LoginProps {
  onLogin: (userData: UserData, token: string) => void;
  onRegister: () => void;
}

function Login({ onLogin, onRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  console.log('[Login Component] Rendered');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email.trim() || !password.trim()) {
      setError('メールアドレスとパスワードを入力してください');
      setIsLoading(false);
      return;
    }

    console.log(`[Login] ログイン試行: ${email}`);

    try {
      const response = await authAPI.login({ email, password });
      
      console.log('[Login] ログイン成功:', response);
      
      if (response.token && response.user) {
        onLogin(response.user, response.token);
      } else {
        throw new Error('ログインレスポンスの形式が無効です');
      }
    } catch (err: any) {
      console.error('[Login] APIログインエラー:', err);
      
      if (err.code === 'ERR_NETWORK') {
        console.error(`[Login] ネットワークエラー詳細: ${err.message}, コード: ${err.code}`);
        setError('サーバーに接続できません。サーバーが起動しているか確認してください。');
      } else if (err.response) {
        console.error(`[Login] サーバーエラー: ${err.response.status}`, err.response.data);
        const message = err.response.data?.error || err.response.data?.message || err.message || 'ログイン処理中にエラーが発生しました。';
        setError(`${message}`);
      } else {
        console.error('[Login] 未分類エラー:', err);
        setError('ネットワークエラー: ' + (err.message || 'ログイン処理中に不明なエラーが発生しました'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">ログイン</h2>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレスを入力"
              disabled={isLoading}
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
        </form>
        <div className="text-sm text-center pt-4">
          <p className="text-gray-600">
            アカウントをお持ちでないですか？{' '}
            <button
              onClick={onRegister}
              className="font-semibold text-indigo-600 hover:text-indigo-800 text-base underline"
            >
              新規登録はこちら
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login; 