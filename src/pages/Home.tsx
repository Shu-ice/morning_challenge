import React, { useState, useEffect } from 'react';
import '../styles/Home.css';
import { DifficultyRank, difficultyToJapanese } from '../types/difficulty';
import { Link } from 'react-router-dom';

interface HomeProps {
  onStartPractice: (difficulty: DifficultyRank) => void;
  isTimeValid: boolean;
}

const Home: React.FC<HomeProps> = ({ onStartPractice, isTimeValid }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    // ユーザーデータを取得
    try {
      const userDataString = localStorage.getItem('userData');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        setIsLoggedIn(userData.isLoggedIn);
      }
    } catch (error) {
      console.error('Failed to parse user data:', error);
    }
  }, []);
  
  const difficultyOptions = [
    { value: 'beginner' as DifficultyRank, label: '初級' },
    { value: 'intermediate' as DifficultyRank, label: '中級' },
    { value: 'advanced' as DifficultyRank, label: '上級' },
    { value: 'expert' as DifficultyRank, label: '超級' },
  ];
  
  const handleStartClick = () => {
    if (isTimeValid) {
      onStartPractice(selectedDifficulty);
    }
  };
  
  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>朝の計算チャレンジ</h1>
        <p className="hero-subtitle">
          毎朝の計算問題で学習習慣をつけよう！
          <br />
          6:30〜8:00の間だけ挑戦できます。
        </p>
        
        {!isTimeValid && (
          <div className="time-notice">
            <div className="time-icon">⏰</div>
            <p>現在は問題挑戦時間外です。<br />明日の朝6:30〜8:00にお越しください。</p>
          </div>
        )}
        
        <div className={`start-challenge-card ${!isTimeValid ? 'disabled' : ''}`}>
          <h2>今日のチャレンジに挑戦しよう！</h2>
          
          <div className="difficulty-selector">
            <label htmlFor="difficulty-select">難易度を選択:</label>
            <select 
              id="difficulty-select"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value as DifficultyRank)}
              disabled={!isTimeValid}
            >
              {difficultyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            className={`button button-primary start-button ${!isTimeValid ? 'disabled' : ''}`}
            onClick={handleStartClick}
            disabled={!isTimeValid}
          >
            スタート
          </button>
          
          <p className="time-info">
            制限時間: 5分間
            <br />
            問題数: 10問
          </p>
        </div>
      </div>
      
      <div className="features-section">
        <h2>朝の計算チャレンジの特徴</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>毎日更新される問題</h3>
            <p>毎朝、新しい計算問題が登場。繰り返し挑戦して、計算力を向上させよう！</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <h3>朝活のきっかけに</h3>
            <p>朝6:30〜8:00の限定公開。朝型生活習慣の形成をサポートします。</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>ランキングシステム</h3>
            <p>難易度ごとのランキングで上位を目指そう！日々の成長を実感できます！</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎮</div>
            <h3>ゲーム感覚で学習</h3>
            <p>正解数と解答時間を競おう！楽しみながら計算力が身につきます。</p>
          </div>
        </div>
      </div>
      
      {isLoggedIn && (
        <div className="admin-link-container">
          <Link to="/admin" className="admin-link">管理者設定</Link>
        </div>
      )}
    </div>
  );
};

export default Home;