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
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #F5F5F7 0%, #FAFAFA 50%, #F5F5F7 100%)' }}>
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.9)', 
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
      }}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <h1 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#1D1D1F',
                  letterSpacing: '-0.02em',
                  textDecoration: 'none',
                  transition: 'all 0.3s ease'
                }} className="hover:text-blue-600">
                  <ruby>
                    朝<rt>あさ</rt>
                  </ruby>
                  の
                  <ruby>
                    計算<rt>けいさん</rt>
                  </ruby>
                  チャレンジ
                </h1>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {user?.isLoggedIn ? (
                <>
                  <Link 
                    to="/" 
                    style={{
                      color: '#424245',
                      fontWeight: '500',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      minWidth: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="hover:text-blue-600 hover:bg-blue-50"
                  >
                    ホーム
                  </Link>
                  <Link 
                    to="/rankings" 
                    style={{
                      color: '#424245',
                      fontWeight: '500',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      minWidth: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="hover:text-blue-600 hover:bg-blue-50"
                  >
                    ランキング
                  </Link>
                  <Link 
                    to="/history" 
                    style={{
                      color: '#424245',
                      fontWeight: '500',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      minWidth: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="hover:text-blue-600 hover:bg-blue-50"
                  >
                    <ruby>
                      履歴<rt>りれき</rt>
                    </ruby>
                  </Link>
                  <Link 
                    to="/profile" 
                    style={{
                      color: '#424245',
                      fontWeight: '500',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      minWidth: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="hover:text-blue-600 hover:bg-blue-50"
                  >
                    マイページ
                  </Link>
                  
                  {user.isAdmin && (
                    <div className="relative" ref={adminMenuRef}>
                      <button 
                        onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                        style={{
                          background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
                          color: 'white',
                          fontWeight: '600',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 4px 12px rgba(52, 199, 89, 0.25)'
                        }}
                        className="focus:outline-none hover:shadow-lg hover:scale-105"
                      >
                        <ruby>
                          管理者<rt>かんりしゃ</rt>
                        </ruby>
                        メニュー
                      </button>
                      <div className={`absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-20 border border-gray-100 ${isAdminMenuOpen ? 'block' : 'hidden'}`} style={{
                        backdropFilter: 'blur(20px)',
                        background: 'rgba(255, 255, 255, 0.95)'
                      }}>
                        <Link 
                          to="/admin/dashboard"
                          onClick={() => setIsAdminMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            fontSize: '0.9rem',
                            color: '#424245',
                            textDecoration: 'none',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                          }}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          📊 ダッシュボード
                        </Link>
                        <Link 
                          to="/admin/generate"
                          onClick={() => setIsAdminMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            fontSize: '0.9rem',
                            color: '#424245',
                            textDecoration: 'none',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                          }}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          <ruby>
                            問題生成<rt>もんだいせいせい</rt>
                          </ruby>
                        </Link>
                        <Link 
                          to="/admin/edit"
                          onClick={() => setIsAdminMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            fontSize: '0.9rem',
                            color: '#424245',
                            textDecoration: 'none',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                          }}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          <ruby>
                            問題編集<rt>もんだいへんしゅう</rt>
                          </ruby>
                          ツール
                        </Link>
                        <Link 
                          to="/admin/users"
                          onClick={() => setIsAdminMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            fontSize: '0.9rem',
                            color: '#424245',
                            textDecoration: 'none',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                          }}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          👥 <ruby>
                            ユーザー管理<rt>ユーザーかんり</rt>
                          </ruby>
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <span style={{
                    color: '#424245',
                    fontWeight: '500',
                    padding: '8px 12px',
                    background: 'rgba(0, 122, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '0.9rem'
                  }}>
                    {user.username}
                  </span>
                  <button
                    onClick={logout}
                    style={{
                      background: 'linear-gradient(135deg, #FF3B30 0%, #D70015 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 12px rgba(255, 59, 48, 0.25)',
                      minWidth: '100px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="hover:shadow-lg hover:scale-105"
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    style={{
                      color: '#424245',
                      fontWeight: '500',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      minWidth: '100px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="hover:text-blue-600 hover:bg-blue-50"
                  >
                    ログイン
                  </Link>
                  <Link 
                    to="/register" 
                    style={{
                      color: '#424245',
                      fontWeight: '500',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      minWidth: '100px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    className="hover:text-blue-600 hover:bg-blue-50"
                  >
                    <ruby>
                      新規登録<rt>しんきとうろく</rt>
                    </ruby>
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p style={{
            textAlign: 'center',
            color: '#86868B',
            fontSize: '0.875rem',
            fontWeight: '400',
            margin: 0
          }}>
            © 2025 
            <ruby>
              朝<rt>あさ</rt>
            </ruby>
            の
            <ruby>
              計算<rt>けいさん</rt>
            </ruby>
            チャレンジ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}; 