import React, { useState } from 'react';
import '../styles/Login.css';
import type { UserData } from '../types/index';
import { authAPI } from '../api/index';
import type { ApplicationError } from '../types/error';
import { extractErrorMessage } from '../types/error';

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
    
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log('[Login] ログイン試行開始:', { email, password: '***' });
      
      const loginData = { email, password };
      console.log('[Login] 送信データ:', { email: loginData.email, password: '***' });
      
      const response = await authAPI.login(loginData);
      
      console.log('[Login] ログインAPIレスポンス:', response);
      console.log('[Login] レスポンス詳細:', {
        success: response.success,
        token: response.token ? 'あり' : 'なし',
        username: response.username,
        email: response.email,
        isAdmin: response.isAdmin
      });
      
      if (response.token && response.username) {
        console.log('[Login] ログイン成功');
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
        console.log('[Login] ユーザーデータ作成:', userDataFromResponse);
        onLogin(userDataFromResponse, token);
      } else {
        console.error('[Login] ログイン失敗 - tokenまたはusernameなし');
        console.error('[Login] 失敗レスポンス:', response);
        setError(response.message || 'ログインに失敗しました。メールアドレスとパスワードを確認してください。');
      }
    } catch (err: unknown) {
      console.error('[Login] APIログインエラー:', err);
      
      const error = err as ApplicationError;
      const errorMessage = extractErrorMessage(error);
      
      // より具体的なエラーハンドリング
      if ('code' in error && error.code === 'ERR_NETWORK') {
        console.error(`[Login] ネットワークエラー詳細: ${error.message}, コード: ${error.code}`);
        setError('サーバーに接続できません。サーバーが起動しているか確認してください。');
      } else {
        setError(errorMessage);
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