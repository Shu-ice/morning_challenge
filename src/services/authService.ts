import apiService from './apiService';

// 型定義を追加
interface UserData {
  email: string;
  password: string;
  username?: string;
  grade?: number | string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface User {
  _id?: string;
  email: string;
  username: string;
  grade?: number | string;
  avatar?: string;
  isLoggedIn?: boolean;
  loginTime?: string;
  isAdmin?: boolean;
}

interface ProfileData {
  username?: string;
  email?: string;
  grade?: number | string;
  avatar?: string;
}

/**
 * 認証関連の処理を行うサービスクラス
 */
class AuthService {
  // ユーザー登録
  async register(userData: UserData) {
    try {
      const response = await apiService.post('/auth/register', userData);
      
      if (response.success) {
        apiService.setToken(response.token);
        this.setCurrentUser(response.user);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // ログイン
  async login(credentials: LoginCredentials) {
    try {
      const response = await apiService.post('/auth/login', credentials);
      
      if (response.token && response.user) {
        apiService.setToken(response.token);
        this.setCurrentUser(response.user);
        return response;
      } else {
        throw new Error(response.error || 'ログインに失敗しました');
      }
    } catch (error) {
      console.error('ログインエラー:', error);
      throw error;
    }
  }
  
  // ログアウト
  logout() {
    apiService.setToken(null);
    localStorage.removeItem('currentUser');
  }
  
  // 現在のユーザー情報を取得
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  }
  
  // 現在のユーザー情報を保存
  setCurrentUser(user: User) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
  
  // プロフィール情報を取得
  async getProfile() {
    try {
      const response = await apiService.get('/auth/me');
      
      if (response.success) {
        this.setCurrentUser(response.data);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // プロフィール更新
  async updateProfile(profileData: ProfileData) {
    try {
      const response = await apiService.put('/auth/profile', profileData);
      
      if (response.success) {
        this.setCurrentUser(response.data);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // ログイン状態のチェック
  isLoggedIn(): boolean {
    return !!apiService.token && !!this.getCurrentUser();
  }
}

export default new AuthService();