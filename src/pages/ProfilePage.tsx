import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import '../styles/ProfilePage.css';
import { UserData } from '../types/index';
import { GRADE_OPTIONS } from '../types/grades';
import { authAPI, userAPI } from '../api/index';
import { ErrorHandler } from '../utils/errorHandler';
import { QUERY_KEYS } from '../hooks/useApiQuery';

interface ProfilePageProps {
  user: UserData;
  onLogout: () => void;
  onViewHistory: () => void;
  onSaveProfile: (updatedUser: UserData) => void;
}

const isValidEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onLogout, onViewHistory, onSaveProfile }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email || '');
  const [grade, setGrade] = useState<string>(String(user.grade ?? ''));
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email || '');
    setGrade(String(user.grade ?? ''));
  }, [user]);

  const handleSave = async () => {
    if (!username.trim()) {
      setError('ユーザー名は必須です');
      return;
    }

    if (email && !isValidEmail(email)) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setError('');
    
    // grade は空文字なら未設定、それ以外に数値形式であればそのまま整数化。
    let finalGrade: number | undefined;
    if (grade === '') {
      finalGrade = undefined;
    } else if (/^\d+$/.test(grade)) {
      finalGrade = parseInt(grade, 10);
    } else {
      finalGrade = undefined;
    }

    const profileData = {
      username,
      email: email || undefined,
      grade: finalGrade
    };

    try {
      // サーバーにAPIコールして実際にプロフィールを更新
      const response = await userAPI.updateProfile(profileData);
      
      if (response.data?.success) {
        // サーバー更新成功後にローカルStateを更新
        const updatedUser = {
          ...user,
          username,
          email: email || undefined,
          grade: finalGrade
        } as UserData;

        onSaveProfile(updatedUser);
        
        // ユーザー名が変更された場合は、ランキングキャッシュを無効化
        if (username !== user.username) {
          console.log('🔄 Username changed, invalidating ranking queries...');
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.rankings] });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.history] });
        }
        
        const usernameChanged = username !== user.username;
        
        setSuccessMessage(
          usernameChanged 
            ? 'プロフィールを更新しました。ランキングページに移動してランキングを確認してください...' 
            : 'プロフィールを更新しました'
        );
        setEditMode(false);
        
        // 成功メッセージを表示し、2秒後に自動的にランキングページへ遷移（ユーザー名変更時のみ）
        setTimeout(() => {
          setSuccessMessage('');
          // ユーザー名が変更された場合はランキングページに遷移
          if (usernameChanged) {
            navigate('/rankings', { replace: false });
          }
        }, 2000);
      } else {
        setError(response.data?.message || 'プロフィールの更新に失敗しました');
      }
    } catch (err: unknown) {
      const handledError = ErrorHandler.handleApiError(err, 'プロフィール更新');
      setError(ErrorHandler.getUserFriendlyMessage(handledError));
    }
  };

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('すべてのパスワード欄を入力してください。');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('新しいパスワードが一致しません。');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新しいパスワードは6文字以上である必要があります。');
      return;
    }

    setIsPasswordLoading(true);
    try {
      const response = await authAPI.updatePassword({ currentPassword, newPassword });
      if (response.success) {
        setPasswordSuccess('パスワードが正常に変更されました。');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setPasswordSuccess(''), 4000);
      } else {
        setPasswordError(response.message || 'パスワードの変更に失敗しました。');
      }
    } catch (err: unknown) {
      const handledError = ErrorHandler.handleApiError(err, 'ProfilePage');
      setPasswordError(ErrorHandler.getUserFriendlyMessage(handledError));
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const getGradeLabel = (gradeValue: number | string | undefined): string => {
    if (gradeValue === undefined || gradeValue === null || gradeValue === '') return '未設定';

    const gradeStr = String(gradeValue);

    const option = GRADE_OPTIONS.find(opt => opt.value === gradeStr);
    if (option) return option.label;

    if (/^[1-6]$/.test(gradeStr)) {
      return `小${gradeStr}年生`;
    }

    return '未設定';
  };

  return (
    <div className="profile-page">
      <h1>マイプロフィール</h1>
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
          {/* ユーザー名変更時にランキングページへのクイックアクセスボタンを表示 */}
          {successMessage.includes('ランキングページに移動') && (
            <div style={{ marginTop: '10px' }}>
              <button 
                onClick={() => navigate('/rankings')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                今すぐランキングを確認
              </button>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      <div className="profile-container">
        {editMode ? (
          <div className="profile-edit-form">
            <div className="form-group">
              <label htmlFor="username">ユーザー名</label>
              <input 
                type="text" 
                id="username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ユーザー名"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">メールアドレス（任意）</label>
              <input 
                type="email" 
                id="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="grade">学年</label>
              <select 
                id="grade" 
                value={grade} 
                onChange={(e) => setGrade(e.target.value)}
              >
                <option value="">学年を選択</option>
                {GRADE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="button-group">
              <button className="save-button" onClick={handleSave}>保存</button>
              <button className="cancel-button" onClick={() => setEditMode(false)}>キャンセル</button>
            </div>

            <hr className="my-6" />
            <h3 className="text-lg font-semibold mb-3">パスワード変更</h3>
            {passwordSuccess && <p className="text-sm text-green-600 mb-3">{passwordSuccess}</p>}
            {passwordError && <p className="text-sm text-red-600 mb-3">{passwordError}</p>}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="form-group">
                <label htmlFor="currentPassword">現在のパスワード</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword">新しいパスワード (6文字以上)</label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmNewPassword">新しいパスワード (確認用)</label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div className="button-group">
                 <button 
                    type="submit" 
                    className="change-password-button"
                    disabled={isPasswordLoading}
                  >
                    {isPasswordLoading ? '変更中...' : 'パスワードを変更'}
                 </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="profile-details">
            <div className="profile-item">
              <span className="profile-label">ユーザー名:</span>
              <span className="profile-value">{user.username}</span>
            </div>
            
            <div className="profile-item">
              <span className="profile-label">メールアドレス:</span>
              <span className="profile-value">{user.email || '未設定'}</span>
            </div>
            
            <div className="profile-item">
              <span className="profile-label">学年:</span>
              <span className="profile-value">{getGradeLabel(user.grade)}</span>
            </div>
            
            <div className="login-info">
              {user.loginTime && (
                 <span>最終ログイン: {new Date(user.loginTime).toLocaleString('ja-JP')}</span>
              )}
            </div>
            
            <div className="button-group">
              <button className="edit-button" onClick={() => setEditMode(true)}>編集</button>
              <button className="history-button" onClick={onViewHistory}>学習履歴を見る</button>
              <button className="logout-button" onClick={onLogout}>ログアウト</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage; 