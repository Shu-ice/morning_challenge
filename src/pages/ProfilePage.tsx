import React, { useState, useEffect } from 'react';
import '../styles/ProfilePage.css';
import { UserData } from '../types';

interface ProfilePageProps {
  user: UserData;
  onLogout: () => void;
  onViewHistory: () => void;
  onSaveProfile: (updatedUser: UserData) => void;
}

const GRADE_OPTIONS = [
  { value: 'nursery', label: '年長まで' },
  { value: '1', label: '小1' },
  { value: '2', label: '小2' },
  { value: '3', label: '小3' },
  { value: '4', label: '小4' },
  { value: '5', label: '小5' },
  { value: '6', label: '小6' },
  { value: 'junior_high', label: '中学生' },
  { value: 'high_school', label: '高校生' },
  { value: 'university', label: '大学生' },
  { value: 'adult', label: '大人' }
];

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onLogout, onViewHistory, onSaveProfile }) => {
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email || '');
  const [grade, setGrade] = useState(user.grade || '');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // ユーザーデータが変更された場合に内部状態を更新
    setUsername(user.username);
    setEmail(user.email || '');
    setGrade(user.grade || '');
  }, [user]);

  const handleSave = () => {
    if (!username.trim()) {
      setError('ユーザー名は必須です');
      return;
    }

    if (email && !isValidEmail(email)) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setError('');
    
    const updatedUser: UserData = {
      ...user,
      username,
      email: email || undefined,
      grade: grade || undefined
    };

    onSaveProfile(updatedUser);
    setSuccessMessage('プロフィールを更新しました');
    setEditMode(false);
    
    // 成功メッセージを3秒後に消す
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  const isValidEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const getGradeLabel = (value: string | undefined): string => {
    if (!value) return '未設定';
    const option = GRADE_OPTIONS.find(opt => opt.value === value);
    return option ? option.label : '未設定';
  };

  return (
    <div className="profile-page">
      <h1>マイプロフィール</h1>
      
      {successMessage && (
        <div className="success-message">{successMessage}</div>
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
              <span>最終ログイン: {new Date(user.loginTime).toLocaleString('ja-JP')}</span>
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