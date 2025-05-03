import React, { useState } from 'react';
import '../styles/Login.css';
import type { LoginCredentials } from '../types';

interface LoginProps {
  onLogin: (credentials: LoginCredentials) => void;
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // 入力検証
    if (!username.trim()) {
      setError('ユーザー名を入力してください');
      return;
    }
    
    if (!password.trim()) {
      setError('パスワードを入力してください');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    // 通常はここでAPI通信するが、今回は簡易的に実装
    setTimeout(() => {
      // 簡易的な認証処理（実際はAPIを使用）
      if (password === '1234') { // デモ用の簡易パスワード
        // ユーザー情報をローカルストレージに保存
        localStorage.setItem('user', JSON.stringify({ 
          username, 
          isLoggedIn: true,
          loginTime: new Date().toISOString()
        }));
        
        // 親コンポーネントに通知
        onLogin({ username, password });
      } else {
        setError('ユーザー名またはパスワードが間違っています');
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>朝の計算チャレンジ</h2>
        <h3>ログイン</h3>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">ユーザー名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ユーザー名を入力"
              disabled={isLoading}
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
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        
        <div className="login-help">
          <p>※開発中のため、パスワードは「1234」でログインできます</p>
          <p>※ユーザー名は自由に入力してください</p>
        </div>
      </div>
    </div>
  );
}

export default Login; 