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
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = () => {
      const savedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      console.log('[AuthContext] Initializing auth...');
      console.log('[AuthContext] Saved user data:', savedUser);
      console.log('[AuthContext] Token exists:', !!token);

      if (savedUser && token) {
        try {
          const userData = JSON.parse(savedUser) as UserData;
          console.log('[AuthContext] Parsed user data:', userData);
          console.log('[AuthContext] isAdmin flag:', userData.isAdmin);
          setUser({ ...userData, isLoggedIn: true });
        } catch (error) {
          console.error('Failed to parse user data:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (userData: UserData, token: string) => {
    console.log('[AuthContext] Login called with:', userData);
    console.log('[AuthContext] isAdmin in login data:', userData.isAdmin);
    
    const userDataToSave: UserData = {
      ...userData,
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
    };

    console.log('[AuthContext] Saving user data:', userDataToSave);
    console.log('[AuthContext] isAdmin in saved data:', userDataToSave.isAdmin);

    setUser(userDataToSave);
    localStorage.setItem('user', JSON.stringify(userDataToSave));
    localStorage.setItem('token', token);
    
    // 保存後の確認
    const savedCheck = localStorage.getItem('user');
    console.log('[AuthContext] Verification - saved data:', savedCheck);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const updateUser = (userData: Partial<UserData>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      console.log('[AuthContext] Updating user:', updatedUser);
      console.log('[AuthContext] Updated isAdmin:', updatedUser.isAdmin);
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

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