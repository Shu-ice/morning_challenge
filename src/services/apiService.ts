import { ErrorHandler } from '../utils/errorHandler';

/**
 * APIリクエストを管理する基本クラス
 */
class ApiService {
  baseUrl: string;
  token: string | null;

  constructor() {
    this.baseUrl = '/api';
    this.token = localStorage.getItem('token');
    console.log(`[ApiService] Initialized with baseUrl: ${this.baseUrl}`);
  }

  // リクエストヘッダーを取得
  getHeaders(): Record<string, string> {
    // 毎回最新のトークンを取得（ログイン後にインスタンス生成済みでも反映）
    const currentToken = this.token || localStorage.getItem('token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
      // クラス内キャッシュを更新
      this.token = currentToken;
    }

    return headers;
  }

  // GETリクエスト
  async get(endpoint: string) {
    try {
      console.log(`[ApiService] GET request to: ${this.baseUrl}${endpoint}`);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include', // CORS対応
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();
    } catch (error) {
      ErrorHandler.handlePromiseRejection(error, 'ApiService GET');
    }
  }

  // POSTリクエスト
  async post(endpoint: string, data: unknown) {
    try {
      console.log(`[ApiService] POST request to: ${this.baseUrl}${endpoint}`, data);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
        credentials: 'include', // CORS対応
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();
    } catch (error) {
      ErrorHandler.handlePromiseRejection(error, 'ApiService POST');
    }
  }

  // PUTリクエスト
  async put(endpoint: string, data: unknown) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // エラーハンドリング
  async handleError(response: Response) {
    try {
      const error = await response.json();
      return {
        status: response.status,
        message: error.error || '不明なエラーが発生しました',
      };
    } catch (e) {
      return {
        status: response.status,
        message: '不明なエラーが発生しました',
      };
    }
  }

  // トークンをセット
  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }
}

const api = new ApiService();
export default api;

// 管理者統計関連のAPI関数
export const getOverview = () => api.get('/admin/stats/overview');
export const getDifficultyStats = (period: string = 'week') => api.get(`/admin/stats/difficulty?period=${period}`);
export const getGradeStats = (period: string = 'week') => api.get(`/admin/stats/grade?period=${period}`);
export const getHourlyStats = (days: number = 7) => api.get(`/admin/stats/hourly?days=${days}`);

// 管理者ダッシュボード専用API
export const getDashboardData = () => api.get('/admin-dashboard');

// システム監視関連
export const getSystemHealth = () => api.get('/monitoring/health');
export const getPerformanceStats = () => api.get('/monitoring/performance');