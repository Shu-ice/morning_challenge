import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import type { Results as ResultsType, LoginCredentials, UserData } from './types'
import { DifficultyRank } from './types/difficulty'

// レイジーロードでコンポーネントをインポート
const Home = lazy(() => import('./pages/Home'))
const Problems = lazy(() => import('@/pages/Problems'))
const Results = lazy(() => import('@/pages/Results'))
const Rankings = lazy(() => import('@/pages/Rankings'))
const UserHistory = lazy(() => import('@/pages/UserHistory'))
const Login = lazy(() => import('@/pages/Login'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const AdminSettings = lazy(() => import('@/pages/AdminSettings'))

// ローディングスピナー
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
  </div>
)

function App() {
  const [isTimeValid, setIsTimeValid] = useState(true)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner')
  const [results, setResults] = useState<ResultsType | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const navigate = useNavigate()

  // Add useEffect to load userData from localStorage on initial render
  useEffect(() => {
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      setUserData(JSON.parse(storedUserData));
    }
  }, []);

  const handleStartPractice = (difficulty: DifficultyRank) => {
    setSelectedDifficulty(difficulty)
    navigate('/problems')
  }

  const handleComplete = (results: ResultsType) => {
    setResults(results)
    navigate('/results')
  }

  const handleViewRankings = () => {
    navigate('/rankings')
  }

  const handleLogin = (credentials: LoginCredentials) => {
    // 仮のログイン処理: ログイン成功時に userData を設定
    const mockUserData: UserData = {
      username: credentials.username,
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
      grade: '5', // 仮の学年データ
      email: 'test@example.com' // 仮のメールデータ
    };
    localStorage.setItem('userData', JSON.stringify(mockUserData));
    setUserData(mockUserData);
    navigate('/');
  }

  const handleLogout = () => {
    localStorage.removeItem('userData');
    setUserData(null);
    navigate('/');
  }

  const handleSaveProfile = (updatedUser: UserData) => {
    localStorage.setItem('userData', JSON.stringify(updatedUser));
    setUserData(updatedUser);
    // ここでAPI経由でバックエンドに保存する処理を追加する想定
  }

  const handleViewHistory = () => {
    navigate('/history');
  }

  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home onStartPractice={handleStartPractice} isTimeValid={isTimeValid} />} />
          <Route path="/problems" element={<Problems difficulty={selectedDifficulty} onComplete={handleComplete} />} />
          <Route path="/results" element={<Results results={results} onViewRankings={handleViewRankings} />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route 
            path="/history" 
            element={userData ? (
              <UserHistory username={userData.username} />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route 
            path="/profile" 
            element={userData ? (
              <ProfilePage 
                user={userData} 
                onLogout={handleLogout}
                onSaveProfile={handleSaveProfile}
                onViewHistory={handleViewHistory}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route 
            path="/admin" 
            element={userData ? (
              <AdminSettings />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

// ルーティングを有効にするためのラッパーコンポーネント
function AppWrapper() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

export default AppWrapper 