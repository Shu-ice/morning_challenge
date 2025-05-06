import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminMenuOpen(false);
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAdminMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900 hover:text-blue-600">朝の計算チャレンジ</h1>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {user?.isLoggedIn ? (
                <>
                  <Link to="/" className="text-gray-700 hover:text-blue-600">ホーム</Link>
                  <Link to="/rankings" className="text-gray-700 hover:text-blue-600">ランキング</Link>
                  <Link to="/history" className="text-gray-700 hover:text-blue-600">履歴</Link>
                  <Link to="/profile" className="text-gray-700 hover:text-blue-600">マイページ</Link>
                  
                  {user.isAdmin && (
                    <div className="relative" ref={adminMenuRef}>
                      <button 
                        onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                        className="text-green-600 hover:text-green-800 font-semibold focus:outline-none px-3 py-1 rounded-md"
                      >
                        管理者メニュー
                      </button>
                      <div className={`absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 ${isAdminMenuOpen ? 'block' : 'hidden'}`}>
                        <Link 
                          to="/admin/generate"
                          onClick={() => setIsAdminMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          問題生成
                        </Link>
                        <Link 
                          to="/admin/edit"
                          onClick={() => setIsAdminMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          問題編集
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <span className="text-gray-700">{user.username}</span>
                  <button
                    onClick={logout}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-700 hover:text-blue-600">ログイン</Link>
                  <Link to="/register" className="text-gray-700 hover:text-blue-600">新規登録</Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            © 2024 朝の計算チャレンジ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}; 