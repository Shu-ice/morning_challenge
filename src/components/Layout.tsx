import { ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

type LayoutProps = {
  children: ReactNode
}

interface UserData {
  username: string;
  isLoggedIn: boolean;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)

  useEffect(() => {
    // ユーザーデータを取得
    try {
      const userDataString = localStorage.getItem('userData')
      if (userDataString) {
        const userData = JSON.parse(userDataString)
        setCurrentUser(userData)
      }
    } catch (error) {
      console.error('Failed to parse user data:', error)
    }
  }, [location.pathname]) // パスが変わるたびに再取得

  const handleLogout = () => {
    localStorage.removeItem('userData')
    setCurrentUser(null)
    navigate('/')
  }

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="font-bold text-xl text-primary-600">
                  朝の計算チャレンジ
                </Link>
              </div>
              <nav className="ml-6 flex space-x-8">
                <Link 
                  to="/" 
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    isActive('/') ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  ホーム
                </Link>
                <Link 
                  to="/rankings" 
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    isActive('/rankings') ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  ランキング
                </Link>
                <Link 
                  to="/history" 
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    isActive('/history') ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  履歴
                </Link>
                <Link 
                  to="/profile"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    isActive('/profile') ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  マイページ
                </Link>
              </nav>
            </div>
            <div className="flex items-center">
              {currentUser && currentUser.isLoggedIn ? (
                <>
                  <span className="mr-4 text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{currentUser.username}</span> さん
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm bg-red-600 text-white hover:bg-red-700"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <Link 
                  to="/login" 
                  className={`ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${
                    isActive('/login') 
                      ? 'bg-primary-700 text-white' 
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  ログイン
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} 朝の計算チャレンジ All rights reserved.
            </p>
            {location.pathname === '/' && (
              <Link 
                to="/admin-settings" 
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                管理者設定
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
} 