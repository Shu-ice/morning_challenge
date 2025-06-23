import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserData } from '../types';

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (userData: UserData, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<UserData>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 🔥 強制デバッグ：即座にログ出力
  console.log('🔥🔥🔥 [AuthContext] PROVIDER FUNCTION CALLED! 🔥🔥🔥');
  console.log('🔥🔥🔥 [AuthContext] React version:', React.version);
  console.log('🔥🔥🔥 [AuthContext] Component rendering...');
  
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 強制デバッグ：useState直後
  console.log('🔥🔥🔥 [AuthContext] useState initialized - user:', user, 'loading:', loading);

  useEffect(() => {
    console.log('🔥🔥🔥 [AuthContext] 🚀 useEffect TRIGGERED! AuthProvider mounted');
    console.log('🔥🔥🔥 [AuthContext] 🔄 Initializing auth...');
    
    const initializeAuth = () => {
      console.log('🔥🔥🔥 [AuthContext] 📦 Getting saved data...');
      const savedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      console.log('🔥🔥🔥 [AuthContext] 📦 Saved user data:', savedUser);
      console.log('🔥🔥🔥 [AuthContext] 🔑 Token exists:', !!token);

      if (savedUser && token) {
        try {
          const userData = JSON.parse(savedUser) as UserData;
          console.log('🔥🔥🔥 [AuthContext] ✅ Parsed user data:', userData);
          console.log('🔥🔥🔥 [AuthContext] 👑 isAdmin flag:', userData.isAdmin);
          console.log('🔥🔥🔥 [AuthContext] 🎯 Setting user state...');
          setUser({ ...userData, isLoggedIn: true });
          console.log('🔥🔥🔥 [AuthContext] ✨ User state set successfully');
        } catch (error) {
          console.error('🔥🔥🔥 [AuthContext] ❌ Failed to parse user data:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      } else {
        console.log('🔥🔥🔥 [AuthContext] ℹ️ No saved auth data found');
      }
      console.log('🔥🔥🔥 [AuthContext] 🏁 Setting loading to false');
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (userData: UserData, token: string) => {
    console.log('🔥🔥🔥 [AuthContext] 🔐 LOGIN FUNCTION CALLED!');
    console.log('🔥🔥🔥 [AuthContext] 📊 Login userData:', userData);
    console.log('🔥🔥🔥 [AuthContext] 👑 isAdmin in login data:', userData.isAdmin);
    console.log('🔥🔥🔥 [AuthContext] 🔑 Token provided:', !!token);
    
    const userDataToSave: UserData = {
      ...userData,
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
    };

    console.log('🔥🔥🔥 [AuthContext] 💾 User data to save:', userDataToSave);
    console.log('🔥🔥🔥 [AuthContext] 👑 isAdmin in data to save:', userDataToSave.isAdmin);

    console.log('🔥🔥🔥 [AuthContext] 🎯 Setting user state...');
    setUser(userDataToSave);
    console.log('🔥🔥🔥 [AuthContext] 💾 Saving to localStorage...');
    localStorage.setItem('user', JSON.stringify(userDataToSave));
    localStorage.setItem('token', token);
    
    // 保存後の確認
    const savedCheck = localStorage.getItem('user');
    console.log('🔥🔥🔥 [AuthContext] ✅ Verification - saved data:', savedCheck);
    
    // Parseして確認
    try {
      const parsedCheck = JSON.parse(savedCheck || '{}');
      console.log('🔥🔥🔥 [AuthContext] 🔍 Verification - parsed isAdmin:', parsedCheck.isAdmin);
    } catch (e) {
      console.error('🔥🔥🔥 [AuthContext] ❌ Verification parse error:', e);
    }

    console.log('🔥🔥🔥 [AuthContext] 🎉 LOGIN PROCESS COMPLETED!');
  };

  const logout = () => {
    console.log('🔥🔥🔥 [AuthContext] 🚪 Logout called');
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    console.log('🔥🔥🔥 [AuthContext] ✅ Logout completed');
  };

  const updateUser = (userData: Partial<UserData>) => {
    console.log('🔥🔥🔥 [AuthContext] 🔄 UpdateUser called');
    if (user) {
      const updatedUser = { ...user, ...userData };
      console.log('🔥🔥🔥 [AuthContext] 📊 Updating user:', updatedUser);
      console.log('🔥🔥🔥 [AuthContext] 👑 Updated isAdmin:', updatedUser.isAdmin);
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      console.log('🔥🔥🔥 [AuthContext] ✅ User updated');
    } else {
      console.warn('🔥🔥🔥 [AuthContext] ⚠️ UpdateUser called but no user exists');
    }
  };

  // 🔥 強制デバッグ：レンダリング時の状態
  console.log('🔥🔥🔥 [AuthContext] 🎭 RENDER - Current state - user:', user, 'loading:', loading);
  console.log('🔥🔥🔥 [AuthContext] 🎭 RENDER - User isAdmin:', user?.isAdmin);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 