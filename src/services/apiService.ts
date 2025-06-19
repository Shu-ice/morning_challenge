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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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

export default new ApiService();