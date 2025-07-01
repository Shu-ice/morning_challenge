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
      // 🔐 セキュリティ修正: パスワードは完全にログから除外
      console.log('[Login] 送信データ:', { email: loginData.email });
      
      const response = await authAPI.login(loginData);
      console.log('[Login] ログインAPIレスポンス:', response);
      
      // レスポンス構造に合わせて修正 - success:trueとtokenの存在を確認
      if (!response.success || !response.token) {
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
      // 🔐 セキュリティ修正: パスワードは完全にログから除外
      console.log('[Login] ログイン試行開始:', { email });
      
      const response = await loginApiWithRetry.execute();
      
      if (response) {
        console.log('[Login] 🎉 ログイン成功');
        console.log('[Login] 🔑 Token received:', !!response.token);
        console.log('[Login] 👤 User data from API:', response.user);
        
        const token = response.token;
        // レスポンス構造に合わせて修正 - response.userからユーザー情報を取得
        const user = response.user;
        const userDataFromResponse: UserData = {
          _id: user._id,
          username: user.username,
          email: user.email,
          grade: user.grade,
          avatar: user.avatar,
          isLoggedIn: true,
          loginTime: new Date().toISOString(),
          isAdmin: user.isAdmin || false,
        };
        console.log('[Login] 🏗️ ユーザーデータ作成:', userDataFromResponse);
        console.log('[Login] 👑 isAdmin in created data:', userDataFromResponse.isAdmin);
        console.log('[Login] 📞 Calling onLogin callback...');
        onLogin(userDataFromResponse, token);
        console.log('[Login] ✅ onLogin callback completed');
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