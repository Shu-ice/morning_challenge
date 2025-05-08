import React, { useState, useEffect } from 'react';
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

enum AppPages {
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

  // ★ currentPage変更時にログを出力するuseEffect
  useEffect(() => {
    console.log(`[App useEffect] currentPage changed to: ${currentPage}`);
  }, [currentPage]);

  useEffect(() => {
    console.log('[App] Initializing app and checking user/token...');
    setLoading(true);
    // const lastDifficulty = getLastUsedDifficulty(); // utils を一旦使わない
    // setSelectedDifficulty(lastDifficulty);

    const savedUser = localStorage.getItem('user'); // localStorage のキーを 'user' に統一
    const token = localStorage.getItem('token'); // トークンも確認
    console.log(`[App] Found user: ${savedUser ? 'Yes' : 'No'}, Found token: ${token ? 'Yes' : 'No'}`);

    if (savedUser && token) { // トークンも存在する場合
      try {
        const userData = JSON.parse(savedUser) as UserData;
        // isAdmin フラグも含めて state に設定 (loginTime も考慮)
        setUser({ ...userData, isLoggedIn: true });
        console.log('[App] User is logged in:', userData.username, 'isAdmin:', userData.isAdmin);
        setCurrentPage(AppPages.HOME); // ログイン済みならホームへ
        console.log('[App after setCurrentPage (initial load, user found)\] currentPage:', AppPages.HOME);
      } catch (error) {
        console.error('[App] Failed to parse user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setCurrentPage(AppPages.LOGIN); // エラー時はログインへ
        console.log('[App after setCurrentPage (initial load, parse error)\] currentPage:', AppPages.LOGIN);
      }
    } else {
      console.log('[App] No user data or token found. Redirecting to login.');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      setCurrentPage(AppPages.LOGIN);
      console.log('[App after setCurrentPage (initial load, no user/token)\] currentPage:', AppPages.LOGIN);
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

  const handleStartPractice = (difficulty: DifficultyRank) => {
    setSelectedDifficulty(difficulty);
    setCurrentPage(AppPages.PROBLEMS);
    console.log('[App after setCurrentPage (handleStartPractice)\] currentPage:', AppPages.PROBLEMS);
  };

  const handleProblemComplete = (results: any) => {
    setProblemResults(results);
    setCurrentPage(AppPages.RESULTS);
    console.log('[App after setCurrentPage (handleProblemComplete)\] currentPage:', AppPages.RESULTS);
  };

  // Login コンポーネントから isAdmin を含むユーザー情報とトークンを受け取る想定
  // Login.tsx側の onLogin (または onLoginSuccess) の引数に合わせる必要がある
  // Login.tsx の props 名と渡すデータ構造を確認してください
  const handleLogin = (userDataFromLogin: UserData, token: string) => {
    console.log('[App] handleLogin called with:', userDataFromLogin);
    // loginTime はここで設定、isLoggedIn も true に
    const userDataToSave: UserData = {
      ...userDataFromLogin, // email, grade, isAdmin を含む想定
      username: userDataFromLogin.username, // username は必須
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
    };

    setUser(userDataToSave);
    localStorage.setItem('user', JSON.stringify(userDataToSave)); // isAdmin も保存
    localStorage.setItem('token', token); // トークンも保存
    console.log('[App] User logged in and data saved:', userDataToSave);
    setCurrentPage(AppPages.HOME); // ホームへ遷移
    console.log('[App after setCurrentPage (handleLogin)\] currentPage:', AppPages.HOME);
  };

  const handleLogout = () => {
    console.log('[App] Logging out...');
    localStorage.removeItem('user');
    localStorage.removeItem('token'); // トークンも削除
    setUser(null);
    setCurrentPage(AppPages.LOGIN);
    console.log('[App after setCurrentPage (handleLogout)\] currentPage:', AppPages.LOGIN);
  };

  const handleViewHistory = () => {
    setCurrentPage(AppPages.HISTORY);
    console.log('[App after setCurrentPage (handleViewHistory)\] currentPage:', AppPages.HISTORY);
  };

  const handleSaveProfile = (updatedUser: UserData) => {
    // 既存のユーザー情報とマージして isLoggedin や loginTime を維持
    // user stateがnullの場合の考慮を追加
    if (user) {
        // loginTime は更新しない想定 (必要なら updatedUser に含めるか、既存のものを保持)
        const mergedUserData = {
            ...user,
            username: updatedUser.username,
            email: updatedUser.email,
            grade: updatedUser.grade,
            // isAdmin はプロフィール編集画面では変更しない想定
            isLoggedIn: true // ログイン状態は維持
        };
        console.log('[App] Saving profile:', mergedUserData);
        setUser(mergedUserData);
        localStorage.setItem('user', JSON.stringify(mergedUserData));
    } else {
        console.error("[App] Cannot save profile: user state is null.");
    }
  };

  const renderPage = () => {
    console.log(`[App] renderPage called. Current page state: ${currentPage}`); // ★ renderPage冒頭ログ
    // --- アクセス制御 ---
    const protectedPages = [
        AppPages.HOME, AppPages.PROBLEMS, AppPages.RESULTS,
        AppPages.RANKINGS, AppPages.PROFILE, AppPages.HISTORY,
        AppPages.ADMIN_DASHBOARD, AppPages.ADMIN_GENERATE, AppPages.ADMIN_EDIT
    ];
    if (!user?.isLoggedIn && protectedPages.includes(currentPage)) {
        console.warn("[App] Access denied. Rendering Login (protectedPages check).");
        // ★★★ Loginレンダリング直前のデバッグ ★★★
        const registerHandler = () => setCurrentPage(AppPages.REGISTER);
        console.log('[Debug] Type of onRegister (protected):', typeof registerHandler); // 関数の型を確認
        return <Login onLogin={handleLogin} onRegister={registerHandler} />;
    }

    // 2. 管理者ページアクセス制御
    const adminPages = [AppPages.ADMIN_DASHBOARD, AppPages.ADMIN_GENERATE, AppPages.ADMIN_EDIT];
    if (adminPages.includes(currentPage) && !user?.isAdmin) {
        console.warn("[App] Access denied (not admin). Rendering Home page.");
        return <Home onStartPractice={handleStartPractice} isTimeValid={isWithinTimeWindow()} defaultDifficulty={selectedDifficulty} />;
    }
    // --- アクセス制御ここまで ---

    switch (currentPage) {
      case AppPages.LOGIN:
        console.log('[App] Rendering Login (switch case).');
        // ★★★ Loginレンダリング直前のデバッグ ★★★
        const registerHandlerSwitch = () => {
            console.log('[App] onRegister が呼ばれました (switch)');
            setCurrentPage(AppPages.REGISTER);
            console.log('[App after setCurrentPage (Login -> onRegister)\] currentPage:', AppPages.REGISTER);
        };
        console.log('[Debug] Type of onRegister (switch):', typeof registerHandlerSwitch); // 関数の型を確認
        return <Login onLogin={handleLogin} onRegister={registerHandlerSwitch} />;
      case AppPages.REGISTER:
        console.log('[App] Registerページを表示します');
        return <Register onRegister={handleLogin} onLogin={() => {setCurrentPage(AppPages.LOGIN); console.log('[App after setCurrentPage (Register -> onLogin)\] currentPage:', AppPages.LOGIN);}} />;
      case AppPages.HOME:
        return <Home onStartPractice={handleStartPractice} isTimeValid={isWithinTimeWindow()} defaultDifficulty={selectedDifficulty} />;
      case AppPages.PROBLEMS:
        return <Problems
                 difficulty={selectedDifficulty}
                 onComplete={handleProblemComplete}
                 onBack={() => setCurrentPage(AppPages.HOME)}
               />;
      case AppPages.RESULTS:
        // Results コンポーネントの props を確認
        return <Results results={problemResults} onViewRankings={() => setCurrentPage(AppPages.RANKINGS)} />;
      case AppPages.RANKINGS:
        // Rankings コンポーネントの props を確認
        return <Rankings /* results={problemResults} */ />;
      case AppPages.HISTORY:
        // UserHistory コンポーネントの props を確認
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
        console.log('[App.tsx] renderPage - Entering ADMIN_GENERATE case. CurrentPage:', currentPage); // ★ 追加ログ
        const isActiveValue = currentPage === AppPages.ADMIN_GENERATE; // ★ 値を一度変数に入れる
        console.log('[App.tsx] Rendering ProblemGenerator. Value passed to isActive:', isActiveValue, 'CurrentPage:', currentPage); // ★ 渡す直前の値とcurrentPageをログ出力
        return <ProblemGenerator isActive={isActiveValue} />;
      case AppPages.ADMIN_EDIT:
        return <ProblemEditor />; // Adminチェック済
      default:
        console.warn(`[App] Unknown page: ${currentPage}. Rendering Home page.`);
        // 未定義ページはホームへ (setCurrentPageは使わない)
        return <Home onStartPractice={handleStartPractice} isTimeValid={isWithinTimeWindow()} defaultDifficulty={selectedDifficulty} />;
    }
  };

  if (loading) {
    return <div className="loading-fullscreen">読み込み中...</div>; // 全画面ローディング表示
  }

  // ヘッダー/フッターを表示するのはログイン済みの場合のみとする (これは以前のバージョン？ヘッダーは常に表示する修正をしたはず)
  // ヘッダーとフッターは常にレンダリングする (これが正しいはず)
  return (
    <div className="app">
      {/* ヘッダーは常に表示 */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo" onClick={() => {setCurrentPage(AppPages.HOME); console.log('[App after setCurrentPage (logo click)\] currentPage:', AppPages.HOME);}} style={{cursor: 'pointer'}}>
            <h1>朝の計算チャレンジ</h1>
          </div>
          <nav className="main-nav">
            <ul>
              <li className={currentPage === AppPages.HOME ? 'active' : ''}>
                <button onClick={() => {setCurrentPage(AppPages.HOME); console.log('[App after setCurrentPage (nav Home)\] currentPage:', AppPages.HOME);}}>ホーム</button>
              </li>
              <li className={currentPage === AppPages.RANKINGS ? 'active' : ''}>
                <button onClick={() => {setCurrentPage(AppPages.RANKINGS); console.log('[App after setCurrentPage (nav Rankings)\] currentPage:', AppPages.RANKINGS);}}>ランキング</button>
              </li>
              <li className={currentPage === AppPages.HISTORY ? 'active' : ''}>
                <button onClick={() => {setCurrentPage(AppPages.HISTORY); console.log('[App after setCurrentPage (nav History)\] currentPage:', AppPages.HISTORY);}}>学習履歴</button>
              </li>
              <li className={currentPage === AppPages.PROFILE ? 'active' : ''}>
                <button onClick={() => {setCurrentPage(AppPages.PROFILE); console.log('[App after setCurrentPage (nav Profile)\] currentPage:', AppPages.PROFILE);}}>マイページ</button>
              </li>
              {/* 管理者用メニュー */}
              {user?.isAdmin && (
                <>
                  <li className={currentPage === AppPages.ADMIN_DASHBOARD ? 'active' : ''}>
                    <button onClick={() => {setCurrentPage(AppPages.ADMIN_DASHBOARD); console.log('[App after setCurrentPage (nav Admin Dashboard)\] currentPage:', AppPages.ADMIN_DASHBOARD);}}>管理DB</button>
                  </li>
                  <li className={currentPage === AppPages.ADMIN_GENERATE ? 'active' : ''}>
                    <button onClick={() => {
                      alert('[Debug] 問題生成ボタンがクリックされました！'); // ★ 確認用アラート
                      console.log('[App.tsx] Navigating to ADMIN_GENERATE (button click)');
                      setCurrentPage(AppPages.ADMIN_GENERATE);
                      console.log('[App after setCurrentPage (nav Admin Generate)\] currentPage:', AppPages.ADMIN_GENERATE);
                    }}>問題生成</button>
                  </li>
                   <li className={currentPage === AppPages.ADMIN_EDIT ? 'active' : ''}>
                    <button onClick={() => {setCurrentPage(AppPages.ADMIN_EDIT); console.log('[App after setCurrentPage (nav Admin Edit)\] currentPage:', AppPages.ADMIN_EDIT);}}>問題編集</button>
                  </li>
                </>
              )}
            </ul>
          </nav>
          <div className="user-info">
            <span onClick={() => {setCurrentPage(AppPages.PROFILE); console.log('[App after setCurrentPage (user-info click)\] currentPage:', AppPages.PROFILE);}} style={{ cursor: 'pointer' }}>
              {user.username}さん {user.isAdmin ? '(Admin)' : ''}
            </span>
            {/* ログアウトボタンはマイページ内などに配置する方が一般的 */}
            {/* <button onClick={handleLogout} className="logout-button-header">ログアウト</button> */}
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