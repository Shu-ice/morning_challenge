import React, { useState, useEffect } from 'react';
import './styles/global.css';
import Home from './pages/Home';
import Problems from './pages/Problems';
import Results from './pages/Results';
import Rankings from './pages/Rankings';
import Login from './pages/Login';
import UserHistory from './pages/UserHistory';
import ProfilePage from './pages/ProfilePage';
import { DifficultyRank, getLastUsedDifficulty } from './utils/problemGenerator';
import { UserData } from './types';

// Simple routing implementation (would use React Router in a real app)
enum AppPages {
  LOGIN = 'login',
  HOME = 'home',
  PROBLEMS = 'problems',
  RESULTS = 'results',
  RANKINGS = 'rankings',
  PROFILE = 'profile',
  HISTORY = 'history'
}

const App = () => {
  const [currentPage, setCurrentPage] = useState(AppPages.HOME);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [problemResults, setProblemResults] = useState(null);
  const [user, setUser] = useState<UserData | null>(null);

  // ユーザーデータとデフォルト難易度をローカルストレージから読み込む
  useEffect(() => {
    // 前回使用した難易度を取得
    const lastDifficulty = getLastUsedDifficulty();
    setSelectedDifficulty(lastDifficulty);
    
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser) as UserData;
        setUser(userData);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        // 不正なデータの場合はクリア
        localStorage.removeItem('user');
      }
    } else {
      // ユーザーデータがない場合はログインページへ
      setCurrentPage(AppPages.LOGIN);
    }
  }, []);

  // This would be fetched from API in a real app
  const isWithinTimeWindow = () => {
    // 開発中は常にtrueを返す
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hour + minutes/60;
    
    // Available between 6:30-8:00
    return (currentTime >= 6.5 && currentTime <= 8.0);
  };

  const handleStartPractice = (difficulty: DifficultyRank) => {
    setSelectedDifficulty(difficulty);
    setCurrentPage(AppPages.PROBLEMS);
  };

  const handleProblemComplete = (results: any) => {
    setProblemResults(results);
    setCurrentPage(AppPages.RESULTS);
  };

  const handleLogin = (username: string) => {
    const userData: UserData = {
      username,
      isLoggedIn: true,
      loginTime: new Date().toISOString()
    };
    
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentPage(AppPages.HOME);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setCurrentPage(AppPages.LOGIN);
  };

  const handleViewHistory = () => {
    setCurrentPage(AppPages.HISTORY);
  };
  
  const handleSaveProfile = (updatedUser: UserData) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const renderPage = () => {
    // ログインしていない場合はログインページのみ表示
    if (!user?.isLoggedIn && currentPage !== AppPages.LOGIN) {
      return <Login onLogin={handleLogin} />;
    }

    switch (currentPage) {
      case AppPages.LOGIN:
        return <Login onLogin={handleLogin} />;
      case AppPages.HOME:
        return <Home onStartPractice={handleStartPractice} isTimeValid={isWithinTimeWindow()} defaultDifficulty={selectedDifficulty} />;
      case AppPages.PROBLEMS:
        return <Problems difficulty={selectedDifficulty} onComplete={handleProblemComplete} />;
      case AppPages.RESULTS:
        return <Results results={problemResults} onViewRankings={() => setCurrentPage(AppPages.RANKINGS)} />;
      case AppPages.RANKINGS:
        return <Rankings results={problemResults} />;
      case AppPages.HISTORY:
        return user ? <UserHistory username={user.username} /> : null;
      case AppPages.PROFILE:
        return user ? (
          <ProfilePage 
            user={user} 
            onLogout={handleLogout} 
            onViewHistory={handleViewHistory} 
            onSaveProfile={handleSaveProfile}
          />
        ) : null;
      default:
        return <Home onStartPractice={handleStartPractice} isTimeValid={isWithinTimeWindow()} defaultDifficulty={selectedDifficulty} />;
    }
  };

  // ログインしていない場合はヘッダーとフッターを表示しない
  if (!user?.isLoggedIn && currentPage !== AppPages.LOGIN) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-container">
          <div className="logo" onClick={() => setCurrentPage(AppPages.HOME)}>
            <h1>朝の計算チャレンジ</h1>
          </div>
          
          {user?.isLoggedIn && (
            <nav className="main-nav">
              <ul>
                <li className={currentPage === AppPages.HOME ? 'active' : ''}>
                  <button onClick={() => setCurrentPage(AppPages.HOME)}>ホーム</button>
                </li>
                <li className={currentPage === AppPages.RANKINGS ? 'active' : ''}>
                  <button onClick={() => setCurrentPage(AppPages.RANKINGS)}>ランキング</button>
                </li>
                <li className={currentPage === AppPages.HISTORY ? 'active' : ''}>
                  <button onClick={() => setCurrentPage(AppPages.HISTORY)}>学習履歴</button>
                </li>
                <li className={currentPage === AppPages.PROFILE ? 'active' : ''}>
                  <button onClick={() => setCurrentPage(AppPages.PROFILE)}>マイページ</button>
                </li>
              </ul>
            </nav>
          )}
          
          {user?.isLoggedIn && (
            <div className="user-info">
              <span onClick={() => setCurrentPage(AppPages.PROFILE)}>{user.username}さん</span>
            </div>
          )}
        </div>
      </header>
      
      <main className="main-content">
        {renderPage()}
      </main>
      
      <footer className="app-footer">
        <div>© 2025 朝の計算チャレンジ</div>
      </footer>
    </div>
  );
};

export default App;