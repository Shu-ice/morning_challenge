import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '@/styles/global.css'; // global.css をインポート
import Home from '@/pages/Home';
import Problems from '@/pages/Problems';
import Results from '@/pages/Results';
import Rankings from '@/pages/Rankings';
import Login from '@/pages/Login';
import UserHistory from '@/pages/UserHistory';
import ProfilePage from '@/pages/ProfilePage';
import Register from '@/pages/Register';
// 管理者コンポーネントのインポート
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ProblemGenerator from '@/pages/admin/ProblemGenerator';
import ProblemEditor from '@/pages/admin/ProblemEditor';

// types.ts に DifficultyRank があると仮定 (なければ定義が必要)
// import { DifficultyRank, getLastUsedDifficulty } from './utils/problemGenerator'; // problemGenerator からのインポートは一旦コメントアウト
type DifficultyRank = 'beginner' | 'intermediate' | 'advanced' | 'expert'; // 仮定義

// types.ts に UserData があると仮定 (isAdmin を含む)
// 現状 App.tsx 内で定義されている UserData を使う or types.ts からインポート
// この例では types.ts からインポートを仮定
import { UserData } from '@/types/index';
// interface UserData { // types.ts がない場合の定義例
//   username: string;
//   isLoggedIn: boolean;
//   email?: string;
//   grade?: number | string;
//   loginTime?: string;
//   isAdmin?: boolean; // 管理者フラグ
// }

// ★ AppPages enum をエクスポート
export enum AppPages {
  LOGIN = 'login',
  REGISTER = 'register',
  HOME = 'home',
  PROBLEMS = 'problems',
  RESULTS = 'results',
  RANKINGS = 'rankings',
  PROFILE = 'profile',
  HISTORY = 'history',
  // 管理者ページを追加
  ADMIN_DASHBOARD = 'admin_dashboard',
  ADMIN_GENERATE = 'admin_generate',
  ADMIN_EDIT = 'admin_edit',
}

const App = () => {
  const [currentPage, setCurrentPage] = useState(AppPages.HOME);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [problemResults, setProblemResults] = useState<any>(null); // results の型をanyに一旦変更
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true); // ローディング状態を追加

  useEffect(() => {
    setLoading(true);
    // const lastDifficulty = getLastUsedDifficulty(); // utils を一旦使わない
    // setSelectedDifficulty(lastDifficulty);

    const savedUser = localStorage.getItem('user'); // localStorage のキーを 'user' に統一
    const token = localStorage.getItem('token'); // トークンも確認

    if (savedUser && token) { // トークンも存在する場合
      try {
        const userData = JSON.parse(savedUser) as UserData;
        const userStateToSet = { ...userData, isLoggedIn: true };
        setUser(userStateToSet);
      } catch (error) {
        console.error('[App] Failed to parse user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setCurrentPage(AppPages.LOGIN); // エラー時はログインへ
      }
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      setCurrentPage(AppPages.LOGIN);
    }
    setLoading(false);
  }, []);

  // 時間チェック関数（変更なし）
  const isWithinTimeWindow = () => {
    if (process.env.NODE_ENV === 'development') return true;
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hour + minutes/60;
    return (currentTime >= 6.5 && currentTime <= 8.0);
  };

  // メモ化したハンドラー関数
  const handleStartPractice = useCallback((difficulty: DifficultyRank) => {
    setSelectedDifficulty(difficulty);
    setCurrentPage(AppPages.PROBLEMS);
  }, []);

  const handleProblemComplete = useCallback((results: any) => {
    setProblemResults(results);
    setCurrentPage(AppPages.RESULTS);
  }, []);

  const handleLogin = useCallback((userDataFromLogin: UserData, token: string) => {
    const userDataToSave: UserData = {
      ...userDataFromLogin,
      username: userDataFromLogin.username,
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
      isAdmin: userDataFromLogin.isAdmin,
    };
    setUser(userDataToSave);
    localStorage.setItem('user', JSON.stringify(userDataToSave));
    localStorage.setItem('token', token);
    setCurrentPage(AppPages.HOME);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setCurrentPage(AppPages.LOGIN);
  }, []);

  const handleViewHistory = useCallback(() => {
    setCurrentPage(AppPages.HISTORY);
  }, []);

  const handleSaveProfile = useCallback((updatedUser: UserData) => {
    if (user) {
        const mergedUserData: UserData = { 
            ...user, 
            username: updatedUser.username,
            email: updatedUser.email,
            grade: updatedUser.grade,
            isLoggedIn: true,
            loginTime: user.loginTime,
            isAdmin: user.isAdmin
        };
        setUser(mergedUserData);
        localStorage.setItem('user', JSON.stringify(mergedUserData));
    } else {
        console.error("[App] Cannot save profile: user state is null.");
    }
  }, [user]);

  // メモ化されたプロテクトページと管理者ページのリスト
  const protectedPages = useMemo(() => [
    AppPages.HOME, AppPages.PROBLEMS, AppPages.RESULTS,
    AppPages.RANKINGS, AppPages.PROFILE, AppPages.HISTORY,
    AppPages.ADMIN_DASHBOARD, AppPages.ADMIN_GENERATE, AppPages.ADMIN_EDIT
  ], []);

  const adminPages = useMemo(() => [
    AppPages.ADMIN_DASHBOARD, AppPages.ADMIN_GENERATE, AppPages.ADMIN_EDIT
  ], []);

  // メモ化されたレンダリング関数
  const renderPage = useCallback(() => {
    // アクセス制御
    if (!user?.isLoggedIn && protectedPages.includes(currentPage)) {
        return <Login
                 onLogin={handleLogin}
                 onRegister={() => setCurrentPage(AppPages.REGISTER)}
               />;
    }

    if (adminPages.includes(currentPage) && !(user?.isAdmin)) {
        return <Home 
            onStartPractice={handleStartPractice} 
            isTimeValid={isWithinTimeWindow()} 
            defaultDifficulty={selectedDifficulty} 
            setCurrentPage={setCurrentPage} 
            user={user}
          />;
    }

    switch (currentPage) {
      case AppPages.LOGIN:
        return user?.isLoggedIn ? <Home 
            onStartPractice={handleStartPractice} 
            isTimeValid={isWithinTimeWindow()} 
            defaultDifficulty={selectedDifficulty} 
            setCurrentPage={setCurrentPage} 
            user={user}
          /> : 
          <Login 
            onLogin={handleLogin} 
            onRegister={() => setCurrentPage(AppPages.REGISTER)}
          />;
      case AppPages.REGISTER:
        return <Register
                 onRegister={handleLogin}
                 onLogin={() => setCurrentPage(AppPages.LOGIN)}
               />;
      case AppPages.HOME:
        return <Home 
            onStartPractice={handleStartPractice} 
            isTimeValid={isWithinTimeWindow()} 
            defaultDifficulty={selectedDifficulty} 
            setCurrentPage={setCurrentPage} 
            user={user}
          />;
      case AppPages.PROBLEMS:
        return <Problems 
                 difficulty={selectedDifficulty} 
                 onComplete={handleProblemComplete} 
                 onBack={() => setCurrentPage(AppPages.HOME)}
               />;
      case AppPages.RESULTS:
        return <Results 
                results={problemResults} 
                onViewRankings={() => setCurrentPage(AppPages.RANKINGS)} 
                onBackToHome={() => setCurrentPage(AppPages.HOME)}
              />;
      case AppPages.RANKINGS:
        return <Rankings /* results={problemResults} */ />;
      case AppPages.HISTORY:
        return user ? <UserHistory /* username={user.username} */ /> : null; // Loginチェック済
      case AppPages.PROFILE:
        return user ? (
          <ProfilePage
            user={user}
            onLogout={handleLogout}
            onViewHistory={handleViewHistory}
            onSaveProfile={handleSaveProfile}
          />
        ) : null; // Loginチェック済
      // 管理者ページの case を追加
      case AppPages.ADMIN_DASHBOARD:
        return <AdminDashboard />; // Adminチェック済
      case AppPages.ADMIN_GENERATE:
        return <ProblemGenerator />; // Adminチェック済
      case AppPages.ADMIN_EDIT:
        return <ProblemEditor />; // Adminチェック済
      default:
        console.warn(`[App] Unknown page: ${currentPage}. Rendering Home page.`);
        // 未定義ページはホームへ (setCurrentPageは使わない)
        return <Home 
            onStartPractice={handleStartPractice} 
            isTimeValid={isWithinTimeWindow()} 
            defaultDifficulty={selectedDifficulty} 
            setCurrentPage={setCurrentPage} 
            user={user}
          />;
    }
  }, [currentPage, user, selectedDifficulty, protectedPages, adminPages, handleLogin, handleLogout, handleProblemComplete, handleSaveProfile, handleStartPractice, handleViewHistory, problemResults]);

  if (loading) {
    return <div className="loading-fullscreen">読み込み中...</div>;
  }

  // ヘッダーとフッターは常にレンダリングする
  return (
    <div className="app">
      {/* ヘッダーは常に表示 */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo" onClick={() => setCurrentPage(AppPages.HOME)} style={{cursor: 'pointer'}}>
            <h1>朝の計算チャレンジ</h1>
          </div>

          {/* ナビゲーションはログイン時のみ表示 */}
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
                {/* 管理者用メニューは isAdmin の場合のみ */}
                {user?.isAdmin && (
                  <>
                    <li className={currentPage === AppPages.ADMIN_DASHBOARD ? 'active' : ''}>
                      <button onClick={() => setCurrentPage(AppPages.ADMIN_DASHBOARD)}>管理DB</button>
                    </li>
                    <li className={currentPage === AppPages.ADMIN_GENERATE ? 'active' : ''}>
                      <button onClick={() => setCurrentPage(AppPages.ADMIN_GENERATE)}>問題生成</button>
                    </li>
                     <li className={currentPage === AppPages.ADMIN_EDIT ? 'active' : ''}>
                      <button onClick={() => setCurrentPage(AppPages.ADMIN_EDIT)}>問題編集</button>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          )}

          {/* 右上のユーザー情報/ログイン/ログアウト */}
          <div className="user-actions">
            {user?.isLoggedIn ? (
              <>
                <span onClick={() => setCurrentPage(AppPages.PROFILE)} style={{ cursor: 'pointer', marginRight: '1em' }}>
                  {user.username}さん {user.isAdmin ? '(Admin)' : ''}
                </span>
                <button onClick={handleLogout} className="button-secondary">ログアウト</button>
              </>
            ) : (
              // ログインしていない場合、ログインページ以外ならログインボタンを表示
              currentPage !== AppPages.LOGIN && (
                  <button onClick={() => setCurrentPage(AppPages.LOGIN)} className="button-primary">ログイン</button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        {renderPage()}
      </main>

      {/* フッターも常に表示 */}
      <footer className="app-footer">
        <div>© 2024 朝の計算チャレンジ</div>
      </footer>
    </div>
  );
};

export default App;