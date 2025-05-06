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

      if (savedUser && token) {
        try {
          const userData = JSON.parse(savedUser) as UserData;
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
    const userDataToSave: UserData = {
      ...userData,
      isLoggedIn: true,
      loginTime: new Date().toISOString(),
    };

    setUser(userDataToSave);
    localStorage.setItem('user', JSON.stringify(userDataToSave));
    localStorage.setItem('token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const updateUser = (userData: Partial<UserData>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
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