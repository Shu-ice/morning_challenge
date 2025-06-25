import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const TopNav: React.FC = () => {
  const { user, logout } = useAuth();
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isAdminMenuOpen || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAdminMenuOpen, isMobileMenuOpen]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsAdminMenuOpen(false);
      }
    };

    if (isMobileMenuOpen || isAdminMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMobileMenuOpen, isAdminMenuOpen]);

  const navLinkStyle = {
    color: '#424245',
    fontWeight: '500' as const,
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    transition: 'all 0.3s ease',
    minWidth: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const mobileNavLinkStyle = {
    color: '#1D1D1F',
    fontWeight: '500' as const,
    textDecoration: 'none',
    padding: '16px 24px',
    borderRadius: '12px',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    fontSize: '1.1rem',
    margin: '4px 0'
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    // Close admin menu if open
    if (isAdminMenuOpen) {
      setIsAdminMenuOpen(false);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header style={{ 
      background: 'rgba(255, 255, 255, 0.9)', 
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      position: 'sticky',
      top: '0',
      zIndex: 50
    }}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <h1 style={{
                fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
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
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center space-x-4">
            {user?.isLoggedIn ? (
              <>
                <Link to="/" style={navLinkStyle} className="hover:text-blue-600 hover:bg-blue-50">
                  ホーム
                </Link>
                <Link to="/rankings" style={navLinkStyle} className="hover:text-blue-600 hover:bg-blue-50">
                  ランキング
                </Link>
                <Link to="/history" style={navLinkStyle} className="hover:text-blue-600 hover:bg-blue-50">
                  <ruby>履歴<rt>りれき</rt></ruby>
                </Link>
                <Link to="/profile" style={navLinkStyle} className="hover:text-blue-600 hover:bg-blue-50">
                  マイページ
                </Link>
                
                {/* Admin Menu */}
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
                      aria-expanded={isAdminMenuOpen}
                      aria-haspopup="true"
                    >
                      <ruby>管理者<rt>かんりしゃ</rt></ruby>メニュー
                    </button>
                    
                    {isAdminMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-20 border border-gray-100" style={{
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
                          <ruby>問題生成<rt>もんだいせいせい</rt></ruby>
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
                          <ruby>問題編集<rt>もんだいへんしゅう</rt></ruby>ツール
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
                          👥 <ruby>ユーザー管理<rt>ユーザーかんり</rt></ruby>
                        </Link>
                      </div>
                    )}
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
                <Link to="/login" style={navLinkStyle} className="hover:text-blue-600 hover:bg-blue-50">
                  ログイン
                </Link>
                <Link to="/register" style={navLinkStyle} className="hover:text-blue-600 hover:bg-blue-50">
                  <ruby>新規登録<rt>しんきとうろく</rt></ruby>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            {user?.isLoggedIn && (
              <span style={{
                color: '#424245',
                fontWeight: '500',
                padding: '6px 10px',
                background: 'rgba(0, 122, 255, 0.1)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                marginRight: '12px'
              }}>
                {user.username}
              </span>
            )}
            
            <button
              onClick={handleMobileMenuToggle}
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-expanded={isMobileMenuOpen}
              aria-label="メニューを開く"
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  transition: 'transform 0.3s ease',
                  transform: isMobileMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
              >
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm z-40"
              onClick={closeMobileMenu}
            />
            
            {/* Mobile Menu */}
            <div 
              ref={mobileMenuRef}
              className="mobile-drawer fixed top-16 right-0 h-[calc(100vh-4rem)] w-80 max-w-[85vw] bg-white shadow-2xl z-50 overflow-y-auto"
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(0, 0, 0, 0.06)',
                transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div className="p-6">
                {user?.isLoggedIn ? (
                  <div className="space-y-2">
                    <Link 
                      to="/" 
                      onClick={closeMobileMenu}
                      style={mobileNavLinkStyle}
                      className="hover:bg-blue-50 hover:text-blue-600"
                    >
                      🏠 ホーム
                    </Link>
                    <Link 
                      to="/rankings" 
                      onClick={closeMobileMenu}
                      style={mobileNavLinkStyle}
                      className="hover:bg-blue-50 hover:text-blue-600"
                    >
                      🏆 ランキング
                    </Link>
                    <Link 
                      to="/history" 
                      onClick={closeMobileMenu}
                      style={mobileNavLinkStyle}
                      className="hover:bg-blue-50 hover:text-blue-600"
                    >
                      📊 <ruby>履歴<rt>りれき</rt></ruby>
                    </Link>
                    <Link 
                      to="/profile" 
                      onClick={closeMobileMenu}
                      style={mobileNavLinkStyle}
                      className="hover:bg-blue-50 hover:text-blue-600"
                    >
                      👤 マイページ
                    </Link>
                    
                    {/* Admin links for mobile */}
                    {user.isAdmin && (
                      <>
                        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }} />
                        <div style={{ 
                          padding: '8px 24px', 
                          fontSize: '0.9rem', 
                          fontWeight: '600', 
                          color: '#34C759',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          <ruby>管理者<rt>かんりしゃ</rt></ruby>メニュー
                        </div>
                        <Link 
                          to="/admin/dashboard" 
                          onClick={closeMobileMenu}
                          style={mobileNavLinkStyle}
                          className="hover:bg-green-50 hover:text-green-600"
                        >
                          📊 ダッシュボード
                        </Link>
                        <Link 
                          to="/admin/generate" 
                          onClick={closeMobileMenu}
                          style={mobileNavLinkStyle}
                          className="hover:bg-green-50 hover:text-green-600"
                        >
                          ⚡ <ruby>問題生成<rt>もんだいせいせい</rt></ruby>
                        </Link>
                        <Link 
                          to="/admin/edit" 
                          onClick={closeMobileMenu}
                          style={mobileNavLinkStyle}
                          className="hover:bg-green-50 hover:text-green-600"
                        >
                          ✏️ <ruby>問題編集<rt>もんだいへんしゅう</rt></ruby>ツール
                        </Link>
                        <Link 
                          to="/admin/users" 
                          onClick={closeMobileMenu}
                          style={mobileNavLinkStyle}
                          className="hover:bg-green-50 hover:text-green-600"
                        >
                          👥 <ruby>ユーザー管理<rt>ユーザーかんり</rt></ruby>
                        </Link>
                      </>
                    )}
                    
                    <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }} />
                    
                    <button
                      onClick={() => {
                        logout();
                        closeMobileMenu();
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #FF3B30 0%, #D70015 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '16px 24px',
                        borderRadius: '12px',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(255, 59, 48, 0.25)',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '4px 0'
                      }}
                      className="hover:shadow-lg hover:scale-105"
                    >
                      🚪 ログアウト
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link 
                      to="/login" 
                      onClick={closeMobileMenu}
                      style={mobileNavLinkStyle}
                      className="hover:bg-blue-50 hover:text-blue-600"
                    >
                      🔑 ログイン
                    </Link>
                    <Link 
                      to="/register" 
                      onClick={closeMobileMenu}
                      style={mobileNavLinkStyle}
                      className="hover:bg-blue-50 hover:text-blue-600"
                    >
                      📝 <ruby>新規登録<rt>しんきとうろく</rt></ruby>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </nav>
    </header>
  );
};