import React, { useState } from 'react';
import '../styles/Login.css';
import type { UserData } from '../types/index';
import { authAPI } from '../api/index';
import { GRADE_OPTIONS } from '../types/grades';
import { ErrorHandler } from '../utils/errorHandler';

interface RegisterProps {
  onRegister: (userData: UserData, token: string) => void;
  onLogin: () => void;
}

function Register({ onRegister, onLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [grade, setGrade] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !username.trim() || grade === '') {
      setError('すべての項目を入力・選択してください');
      return;
    }
    if (username.length < 3 || username.length > 20) {
      setError('ユーザー名は3文字以上20文字以下で入力してください');
      return;
    }
    const gradeNum = parseInt(grade, 10);
    // 有効な学年: 1-6(小学生), 7(その他), 999(ひみつ)
    const validGrades = [1, 2, 3, 4, 5, 6, 7, 999];
    if (isNaN(gradeNum) || !validGrades.includes(gradeNum)) {
      setError('有効な学年を選択してください');
      return;
    }
    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.register({ email, password, username, grade: gradeNum });

      console.log('[Register] 登録成功:', response);
      
      if (response.token && response._id) {
        const token = response.token;
        const userDataFromResponse: UserData = {
          _id: response._id,
          username: response.username,
          email: response.email,
          grade: response.grade,
          avatar: response.avatar || '😊',
          isLoggedIn: true,
          loginTime: new Date().toISOString(),
          isAdmin: response.isAdmin || false,
        };
        
        console.log('[Register] 自動ログイン実行中...', userDataFromResponse);
        setIsSuccess(true);
        
        // 少し遅延させて成功メッセージを表示してから自動ログイン
        setTimeout(() => {
          onRegister(userDataFromResponse, token);
        }, 1000);
      } else {
        let errorMessage = '登録レスポンスの形式が無効です。';
        if (!response.token) errorMessage += ' トークンがありません。';
        if (!response._id) errorMessage += ' ユーザーIDがありません。';
        console.error('[Register] Invalid response structure:', response);
        throw new Error(errorMessage);
      }
    } catch (err: unknown) {
      const handledError = ErrorHandler.handleApiError(err, 'Register');
      setError(ErrorHandler.getUserFriendlyMessage(handledError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">新規登録</h2>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {isSuccess && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
            <p className="font-medium">✅ 登録完了！自動的にログインしています...</p>
          </div>
        )}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">ユーザー名 (3-20文字)</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ユーザー名を入力"
              disabled={isLoading}
              minLength={3}
              maxLength={20}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレスを入力"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="grade">学年</label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={isLoading}
              required
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">学年を選択してください</option>
              {GRADE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力 (6文字以上推奨)"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">パスワード（確認）</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="パスワードを再入力"
              disabled={isLoading}
              required
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSuccess ? '登録完了 - ログイン中...' : isLoading ? '登録中...' : '登録'}
            </button>
          </div>
        </form>
        <div className="text-sm text-center pt-4">
          <p className="text-gray-600">
            すでにアカウントをお持ちですか？{' '}
            <button 
              onClick={onLogin}
              className="font-semibold text-indigo-600 hover:text-indigo-800 text-base underline"
            >
              ログインはこちら
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register; 