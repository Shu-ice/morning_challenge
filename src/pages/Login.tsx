import React, { useState } from 'react';
import '../styles/Login.css';
import type { UserData } from '../types/index';
import { authAPI } from '../api/index';
import type { ApplicationError } from '../types/error';
import { extractErrorMessage } from '../types/error';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner, { ButtonSpinner } from '../components/LoadingSpinner';
import useApiWithRetry from '../hooks/useApiWithRetry';

interface LoginProps {
  onLogin: (userData: UserData, token: string) => void;
  onRegister: () => void;
}

function Login({ onLogin, onRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false); // ユーザーが操作したかどうか

  // 統一エラーハンドリング用のAPIフック
  const loginApiWithRetry = useApiWithRetry(
    async () => {
      const loginData = { email, password };
      console.log('[Login] 送信データ:', { email: loginData.email, password: '***' });
      
      const response = await authAPI.login(loginData);
      console.log('[Login] ログインAPIレスポンス:', response);
      
      if (!response.token || !response.username) {
        throw new Error(response.message || 'ログインに失敗しました。メールアドレスとパスワードを確認してください。');
      }
      
      return response;
    },
    {
      maxRetries: 2,
      retryDelay: 1500,
      retryCondition: (error) => {
        // ネットワークエラーとサーバーエラー（500番台）のみリトライ
        if ('code' in error && error.code === 'ERR_NETWORK') return true;
        if ('status' in error && typeof error.status === 'number') {
          return error.status >= 500;
        }
        return false;
      }
    }
  );

  console.log('[Login Component] Rendered');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasInteracted(true); // フォーム送信時にインタラクションフラグを設定
    
    if (!email || !password) {
      // バリデーションエラーはリトライ機能ではなく直接表示
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('[Login] ログイン試行開始:', { email, password: '***' });
      
      const response = await loginApiWithRetry.execute();
      
      if (response) {
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
      }
    } catch (err: unknown) {
      // useApiWithRetryが既にエラーを管理しているので、ここでは追加処理のみ
      console.error('[Login] APIログインエラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // バリデーションエラー - ユーザーがフォーム送信を試行した後のみ表示
  const validationError = hasInteracted && (!email || !password) 
    ? 'メールアドレスとパスワードを入力してください。' 
    : null;

  return (
    <div className="login-container">
      <div className="login-card">
        {/* ヘッダーセクション */}
        <div className="login-header">
          <div className="login-icon"></div>
          <h1 className="login-title">ログイン</h1>
          <p className="login-subtitle">アカウントにサインインしてください</p>
        </div>

        {/* 統一エラー表示 */}
        <ErrorDisplay 
          error={validationError || loginApiWithRetry.error}
          onRetry={loginApiWithRetry.error ? loginApiWithRetry.retry : undefined}
          showDetails={false}
        />

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
                disabled={isLoading || loginApiWithRetry.loading}
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
                disabled={isLoading || loginApiWithRetry.loading}
                className="form-input"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || loginApiWithRetry.loading}
            className="login-button"
          >
            {(isLoading || loginApiWithRetry.loading) ? (
              <>
                <ButtonSpinner />
                {loginApiWithRetry.isRetrying ? `再試行中... (${loginApiWithRetry.retryCount}回目)` : '処理中...'}
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
            disabled={isLoading || loginApiWithRetry.loading}
          >
            新規登録はこちら
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login; 