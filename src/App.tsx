import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProblemProvider, useProblem } from './contexts/ProblemContext';
import { MainLayout } from './layouts/MainLayout';
import type { Results } from './types/index';

// ページコンポーネント
import Home from './pages/Home';
import Problems from './pages/Problems';
import ResultsPage from './pages/Results';
import Rankings from './pages/Rankings';
import Login from './pages/Login';
import Register from './pages/Register';
import UserHistory from './pages/UserHistory';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProblemGenerator from './pages/admin/ProblemGenerator';
import ProblemEditor from './pages/admin/ProblemEditor';

// --- 保護されたルートのラッパー --- 
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-fullscreen">読み込み中...</div>;
  if (!user?.isLoggedIn) {
    // ログ追加：なぜリダイレクトされるか
    console.log('[ProtectedRoute] Not logged in, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// --- 管理者専用ルートのラッパー ---
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-fullscreen">読み込み中...</div>;
  if (!user?.isLoggedIn) {
    console.log('[AdminRoute] Not logged in, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  if (!user?.isAdmin) {
    console.log('[AdminRoute] Not admin, redirecting to /');
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// --- アプリケーション本体 --- 
const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ProblemProvider>
          {/* MainLayout と Routes をレンダリングするコンポーネント */}
          <AppRoutes />
        </ProblemProvider>
      </AuthProvider>
    </Router>
  );
};

// --- ルーティング定義と、Context を使用するロジック --- 
const AppRoutes: React.FC = () => {
  const { user, login, logout, updateUser, loading } = useAuth();
  const { startSession, currentSession } = useProblem();
  const navigate = useNavigate();
  const location = useLocation();

  // AuthContext のローディングが完了するまで待機
  if (loading) {
    return <div className="loading-fullscreen">認証情報読み込み中...</div>;
  }

  // 時間制限チェック関数
  const isWithinTimeWindow = () => {
    if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_DISABLE_TIME_CHECK === 'true') {
        return true;
    }
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hour + minutes/60;
    return (currentTime >= 6.5 && currentTime <= 8.0);
  };

  return (
    <MainLayout>
      <Routes>
        {/* --- 公開ルート --- */}
        <Route
          path="/login"
          element={
            user?.isLoggedIn ? <Navigate to="/" replace /> : // ログイン済みならホームへ
            <Login
              onLogin={(userData, token) => {
                console.log('[AppRoutes] Handling login...');
                login(userData, token);
                navigate('/', { replace: true });
              }}
              onRegister={() => navigate('/register')}
            />
          }
        />
        <Route
          path="/register"
          element={
            user?.isLoggedIn ? <Navigate to="/" replace /> : // ログイン済みならホームへ
            <Register
              onRegister={(userData, token) => {
                console.log('[AppRoutes] Handling registration...');
                login(userData, token);
                navigate('/', { replace: true });
              }}
              onLogin={() => navigate('/login')}
            />
          }
        />

        {/* --- 保護されたルート --- */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home
                onStartPractice={(difficulty) => {
                    console.log(`[AppRoutes] Starting practice with ${difficulty}`);
                    startSession(difficulty);
                    navigate('/problems');
                }}
            isTimeValid={isWithinTimeWindow()} 
                defaultDifficulty={currentSession?.difficulty || 'beginner'}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/problems"
          element={
            <ProtectedRoute>
              <Problems
                difficulty={currentSession?.difficulty || 'beginner'}
                onComplete={() => navigate('/results')}
                onBack={() => navigate('/')}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <ResultsPage
                results={currentSession as unknown as Results}
                onViewRankings={() => {
                  // 難易度をランキングページに渡すためにstateを使用
                  navigate('/rankings', { 
                    state: { selectedDifficulty: currentSession?.difficulty } 
                  });
                }}
                onBackToHome={() => navigate('/')}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rankings"
          element={<ProtectedRoute><Rankings /></ProtectedRoute>}
        />
        <Route
          path="/history"
          element={<ProtectedRoute><UserHistory /></ProtectedRoute>}
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
          <ProfilePage
                user={user!} // ProtectedRouteでnullでないことを保証
                onLogout={() => {
                  console.log('[AppRoutes] Handling logout...');
                  logout();
                  navigate('/login', { replace: true });
                }}
                onViewHistory={() => navigate('/history')}
                onSaveProfile={updateUser}
              />
            </ProtectedRoute>
          }
        />

        {/* --- 管理者専用ルート --- */}
        <Route
          path="/admin"
          element={<AdminRoute><AdminDashboard /></AdminRoute>}
        />
        <Route
          path="/admin/generate"
          element={(
            <AdminRoute>
              <ProblemGenerator isActive={location.pathname === '/admin/generate'} />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/edit"
          element={<AdminRoute><ProblemEditor /></AdminRoute>}
        />

        {/* --- Not Found --- */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </MainLayout>
  );
};

export default App;