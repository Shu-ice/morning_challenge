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
      
      if (response && response.token && response._id) {
        const token = response.token;
        const userDataFromResponse: UserData = {
          _id: response._id,
          username: response.username,
          email: response.email,
          grade: response.grade,
          avatar: response.avatar,
          isLoggedIn: true,
          loginTime: new Date().toISOString(),
          isAdmin: response.isAdmin || false,
        };
        onLogin(userDataFromResponse, token);
      } else {
        let errorMessage = 'ログインレスポンスの形式が無効です。';
        if (!response.token) errorMessage += ' トークンがありません。';
        if (!response._id) errorMessage += ' ユーザーID (_id) がありません。';
        console.error('[Login] Invalid response structure:', response); 
        throw new Error(errorMessage);
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
    <div className="login-container">
      <div className="login-card">
        {/* ヘッダーセクション */}
        <div className="login-header">
          <div className="login-icon"></div>
          <h1 className="login-title">ログイン</h1>
          <p className="login-subtitle">アカウントにサインインしてください</p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="error-message">
            <div className="error-icon"></div>
            <p>{error}</p>
          </div>
        )}

        {/* ログインフォーム */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                disabled={isLoading}
                autoFocus
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <div className="input-wrapper">
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                disabled={isLoading}
                className="form-input"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="login-button"
          >
            {isLoading ? (
              <>
                <div className="loading-spinner"></div>
                処理中...
              </>
            ) : (
              'ログイン'
            )}
          </button>
        </form>

        {/* 新規登録リンク */}
        <div className="register-section">
          <p className="register-text">
            アカウントをお持ちでないですか？
          </p>
          <button
            onClick={onRegister}
            className="register-link"
            disabled={isLoading}
          >
            新規登録はこちら
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login; 