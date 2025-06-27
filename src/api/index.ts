import axios from 'axios';
// import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { DifficultyRank } from '@/types/difficulty';
import type { ProblemsApiResponse, SubmitAnswersApiResponse, RankingApiResponse, LoginResponseData, Problem, RegisterData, LoginCredentials, ProfileUpdateData, SubmitAnswersRequest } from '@/types/index';
import { logger } from '@/utils/logger';
import { ErrorHandler } from '@/utils/errorHandler';

// バックエンドAPIの基本URL - Viteのプロキシ設定を利用
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// バックエンドAPIの状態を確認
logger.info(`[API] Connecting to backend API at: ${API_BASE_URL}`);

// APIクライアントの初期設定
const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000, // 10秒から30秒にタイムアウト設定を延長
});

// リクエストインターセプター
API.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // 認証トークンの設定
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      logger.debug('[API] Request with token:', config.url);
      
      // トークン情報をデコードしてリクエストに追加（開発用）
      try {
        // JWT形式のtoken（header.payload.signature）からpayload部分をデコード
        const tokenPayload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(tokenPayload));
        
        // デバッグ情報としてトークンに含まれるユーザー情報をログに出力
        if (decodedPayload.username || decodedPayload.sub) {
          logger.debug(`[API] Token contains user: ${decodedPayload.username || decodedPayload.sub}`);
          
          // ローカルストレージにユーザー情報を保存していない場合は、トークンから取得して保存
          if (!localStorage.getItem('user')) {
            const basicUserInfo = {
              username: decodedPayload.username || decodedPayload.sub,
              id: decodedPayload.id || decodedPayload.userId || decodedPayload.sub
            };
            localStorage.setItem('tokenUser', JSON.stringify(basicUserInfo));
            logger.debug('[API] Stored basic user info from token');
          }
        }
      } catch (e) {
        // トークンのデコードに失敗しても続行
        logger.debug('[API] Failed to decode token (not JWT format or invalid)');
      }
    } else {
      logger.debug('[API] Request without token:', config.url);
    }
    return config;
  },
  (error: AxiosError) => {
    logger.error('[API] Request configuration error:', error.message);
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
API.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    logger.debug(`[API] Response from ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error: AxiosError) => {
    // ネットワークエラーの詳細な処理
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      logger.error(`[API] Network error (${error.code}): ${error.message}`);
      logger.error('[API] Please check if the server is running at the correct port (5003)');
      logger.error('[API] Command to start server: cd server && cross-env PORT=5003 DISABLE_TIME_CHECK=true MONGODB_MOCK=true node server.js');
    } else if (error.response) {
      // サーバーからのエラーレスポンス
      logger.error(`[API] Error ${error.response.status}: ${(error.response.data as { message?: string })?.message || error.message}`);
      logger.error('[API] Response data:', error.response.data as object);
    } else {
      logger.error('[API] Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// --- Axios クライアントテスト関数 ---
// バックエンドが応答しているか確認する
const testBackendConnection = async () => {
  logger.info('[API] Testing backend connection...');
  try {
    const response = await API.get('/health');
    logger.info('[API] Backend connection successful:', response.data);
    return true;
  } catch (error: unknown) {
    const axiosError = error as AxiosError;
    logger.error('[API] Backend connection failed:', axiosError.message);
    return false;
  }
};

// 起動時に自動的にバックエンド接続をテスト
setTimeout(() => {
  testBackendConnection().then(isConnected => {
    if (isConnected) {
      logger.info('[API] Application ready: backend is connected');
    } else {
      logger.warn('[API] Application warning: backend connection failed');
    }
  });
}, 1000);

// --- 認証関連 API ---
const authAPI = {
  register: async (userData: RegisterData) => {
    try {
      // 🔐 セキュリティ修正: パスワードを除外したログ出力
      logger.info('[API] Register request:', { 
        email: userData.email, 
        username: userData.username, 
        grade: userData.grade 
      });
      
      // email/username の両方のフィールドを送信してバックエンドの柔軟性を確保
      const processedData = {
        ...userData,
        email: userData.email,
        username: userData.username || userData.email // usernameがない場合はemailを使用
      };
      
      const response = await API.post('/auth/register', processedData);
      logger.debug('[API] Register response:', response.data);
      
      // 登録成功時もトークンをローカルストレージに保存
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        logger.debug('[API] Token saved to localStorage after registration');
      }
      
      return response.data;
    } catch (error: unknown) {
      logger.error('[API] Register error:', (error as Error).message);
      throw error;
    }
  },
  
  login: async (credentials: LoginCredentials) => {
    try {
      // 🔐 セキュリティ修正: パスワードを除外したログ出力
      logger.info('[API] Login request:', { email: credentials.email });
      
      // バックエンドはemail/passwordを期待しているので、直接送信
      const loginData = {
        email: credentials.email,
        password: credentials.password
      };
      
      const response = await API.post('/auth/login', loginData);
      logger.debug('[API] Login response:', response.data);
      
      // ログイン成功時にトークンをローカルストレージに保存
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        logger.debug('[API] Token saved to localStorage');
      }
      
      return response.data;
    } catch (error: unknown) {
      logger.error('[API] Login error:', (error as Error).message);
      throw error;
    }
  },
  
  updatePassword: async (passwordData: { currentPassword: string, newPassword: string }) => {
    try {
      const response = await API.put('/auth/update-password', passwordData);
      return response.data;
    } catch (error: unknown) {
      logger.error('[API] Update password error:', (error as Error).message);
      throw error;
    }
  },
  
  logout: async () => {
    try {
      // バックエンドにログアウトリクエストを送信して Cookie をクリア
      await API.post('/auth/logout'); 
      logger.info('[API] Logout request sent to backend');
    } catch (error) {
      // バックエンドでのログアウトに失敗しても、フロントエンドの処理は続行
      logger.error('[API] Backend logout failed, proceeding with local cleanup:', error as Error);
    } finally {
      // 常にローカルストレージはクリアする
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      logger.info('[API] User logged out locally, token removed');
    }
  },
  
  // ★ 追加: ログイン状態確認
  checkLoginStatus: async () => {
    try {
      const response = await API.get('/auth/me');
      logger.debug('[API] Login status check response:', response.data);
      // 成功したらユーザー情報を返す
      return response.data; // { success: true, user: {...} }
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      // 401 Unauthorized など、認証されていない場合はエラーになる
      logger.debug('[API] Login status check failed (likely not logged in):', axiosError.response?.status);
      // エラーの場合は null または特定のオブジェクトを返すなど、呼び出し元で処理しやすい形式にする
      return { success: false, user: null }; 
    }
  }
};

// --- ユーザー関連 API (プロフィール取得/更新など) ---
const userAPI = {
  getProfile: () => API.get('/users/profile'),
  updateProfile: (userData: ProfileUpdateData) => API.put('/users/profile', userData)
};

// --- 問題関連 API ---
const problemsAPI = {
  getProblems: async (difficulty: DifficultyRank, date?: string) => {
    try {
      logger.info(`[API] 問題取得リクエスト: difficulty=${difficulty}, date=${date || '今日'}`);
      
      // クエリパラメータを設定
      const params: { difficulty: DifficultyRank; date?: string } = { difficulty };
      if (date) params.date = date;
      
      logger.debug(`[API] 問題取得パラメータ:`, params);
      
      const response = await API.get('/problems', { 
        params,
        timeout: 15000 // タイムアウトを15秒に設定
      });
      
      logger.debug(`[API] 問題取得レスポンス:`, response.data);
      
      // API応答がない場合や形式が異なる場合に対応
      if (!response.data) {
        throw new Error('API応答が空です');
      }
      
      // 応答データの標準化
      const problems = response.data.data || response.data.problems || [];
      
      // 問題がない場合の処理
      if (!problems || problems.length === 0) {
        logger.warn(`[API] 問題が見つかりませんでした: ${date}, ${difficulty}`);
        return {
          success: false,
          message: `${date || '今日'}の${difficulty}難易度の問題は見つかりませんでした。`,
          problems: []
        };
      }
      
      return {
        success: true,
        message: response.data.message || '問題を取得しました',
        problems: problems
      };
    } catch (error: unknown) {
      logger.error(`[API] Get problems error:`, error as Error);
      
      const err = error as Error;
      
      // エラーレスポンスを整形
      let errorMessage = '問題の取得に失敗しました。';
      
      if ('response' in err && typeof (err as AxiosError).response === 'object') {
        // サーバーからのエラーレスポンス
        const response = (err as AxiosError).response;
        const responseData = response?.data as { message?: string; error?: string; isAlreadyCompleted?: boolean };
        
        // 409エラー（日次制限）の特別処理
        if (response?.status === 409 && responseData?.isAlreadyCompleted) {
          return {
            success: false,
            message: responseData.message || '本日は既にチャレンジを完了しています。',
            problems: [],
            isAlreadyCompleted: true,
            shouldRedirectHome: true
          };
        }
        
        errorMessage = responseData?.message || 
                       responseData?.error || 
                       `サーバーエラー (${response?.status})`;
      } else if ('request' in err) {
        // リクエストは送信されたが、レスポンスがない
        errorMessage = 'サーバーからの応答がありません。ネットワーク接続を確認してください。';
      } else {
        // リクエスト設定時のエラー
        errorMessage = err.message || '予期せぬエラーが発生しました。';
      }
      
      const errorResponse = {
        success: false,
        message: errorMessage,
        problems: []
      };
      
      logger.error(`[API] 問題取得エラーレスポンス:`, errorResponse);
      return errorResponse; // エラー時はスローせず、エラーレスポンスを返す
    }
  },
  
  submitAnswers: async (data: SubmitAnswersRequest) => {
    try {
      logger.info('[API] 回答送信リクエスト');
      const response = await API.post('/problems', data);
      return response.data as SubmitAnswersApiResponse;
    } catch (error) {
      logger.error('[API] 回答送信エラー:', (error as Error).message);
      throw error;
    }
  },
  
  generateProblems: async (options: {
    date: string,
    difficulty: DifficultyRank,
    count?: number,
    force?: boolean
  }) => {
    try {
      const response = await API.post('/problems/generate', options);
      return response.data;
    } catch (error) {
      logger.error(`[API] Generate problems error:`, error as Error);
      throw error;
    }
  },
  
  getProblemsForEdit: async (difficulty: DifficultyRank, date: string) => {
    try {
      const response = await API.get('/problems/edit', { 
        params: { difficulty, date } 
      });
      return response.data;
    } catch (error) {
      logger.error(`[API] Get problems for edit error:`, error as Error);
      throw error;
    }
  },
  
  saveEditedProblems: async (data: {
    date: string,
    difficulty: DifficultyRank,
    problems: Problem[]
  }) => {
    try {
      const response = await API.post('/problems/edit', data);
      return response.data;
    } catch (error) {
      logger.error(`[API] Save edited problems error:`, error as Error);
      throw error;
    }
  },

  getHistory: async () => {
    try {
      logger.info('[API] 履歴取得リクエスト (認証情報を使用)');
      // /api/history エンドポイントを使用するように変更
      const response = await API.get('/history'); 
      logger.debug('[API] 履歴取得レスポンス:', response.data);
      return response.data;
    } catch (error: unknown) {
      logger.error('[API] Get history error:', error as Error);
      throw error; // エラーを再スローして呼び出し元で処理
    }
  }
};

// --- ランキング関連 API ---
const rankingAPI = {
  getAll: (limit: number = 10, difficulty?: DifficultyRank) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (difficulty) params.append('difficulty', difficulty);
    return API.get(`/rankings?${params.toString()}`);
  },
  getDaily: async (limit: number = 10, difficulty?: DifficultyRank, date?: string) => {
    try {
      logger.info(`[API] ランキング取得リクエスト: difficulty=${difficulty || 'すべて'}, limit=${limit}, date=${date || '今日'}`);
      
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (difficulty) params.append('difficulty', difficulty);
      if (date) params.append('date', date);
      
      const token = localStorage.getItem('token');
      if (!token) {
        logger.warn('[API] 認証トークンがありません。ランキング取得に失敗する可能性があります。');
      }
      
      const response = await API.get(`/rankings?${params.toString()}`);
      logger.debug(`[API] ランキング取得レスポンス:`, response.data);
      
      if (!response.data) {
        throw new Error('ランキングデータが空です');
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      logger.error(`[API] Get rankings error:`, error as Error);
      return {
        success: false,
        message: (axiosError.response?.data as { message?: string })?.message || 'ランキングの取得に失敗しました',
        data: { rankings: [] }
      };
    }
  },
  getWeekly: (limit: number = 10, difficulty?: DifficultyRank) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (difficulty) params.append('difficulty', difficulty);
    return API.get(`/rankings/weekly?${params.toString()}`);
  },
  getMonthly: (limit: number = 10, difficulty?: DifficultyRank) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (difficulty) params.append('difficulty', difficulty);
    return API.get(`/rankings/monthly?${params.toString()}`);
  },
  getByGrade: (grade: number, limit: number = 10, difficulty?: DifficultyRank) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (difficulty) params.append('difficulty', difficulty);
    return API.get(`/rankings/grade/${grade}?${params.toString()}`);
  }
};

// 管理者API
const adminAPI = {
  // システム統計 - 統合エンドポイント使用
  getOverview: () => API.get('/admin-stats?type=overview'),
  getDifficultyStats: (period = 'week') => API.get(`/admin-stats?type=difficulty&period=${period}`),
  getGradeStats: (period = 'week') => API.get(`/admin-stats?type=grade&period=${period}`),
  getHourlyStats: (days = 7) => API.get(`/admin-stats?type=hourly&days=${days}`),
  getProblemSetStats: () => API.get('/admin/stats/problemsets'),
  
  // ユーザー管理
  getUsers: (params: {
    page?: number;
    limit?: number;
    search?: string;
    grade?: number;
    sortBy?: string;
    order?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    return API.get(`/admin/users?${queryParams.toString()}`);
  },
  
  // 従来の問題生成
  generateProblems: (date: string) => API.post(`/admin/generate-problems/${date}`),

  // 管理者権限管理
  makeAdmin: async (userId: string) => {
    try {
      logger.info('[API] Making user admin:', userId);
      const response = await API.put(`/admin/users/${userId}/make-admin`);
      return response;
    } catch (error: unknown) {
      logger.error('[API] Make admin error:', (error as Error).message);
      throw error;
    }
  },

  removeAdmin: async (userId: string) => {
    try {
      logger.info('[API] Removing admin rights:', userId);
      const response = await API.put(`/admin/users/${userId}/remove-admin`);
      return response;
    } catch (error: unknown) {
      logger.error('[API] Remove admin error:', (error as Error).message);
      throw error;
    }
  },
};

// 監視・パフォーマンスAPI
const monitoringAPI = {
  // パフォーマンス統計 - 統合エンドポイント使用
  getPerformanceStats: () => API.get('/monitoring?type=performance'),
  
  // システムヘルスチェック - 統合エンドポイント使用
  getSystemHealth: () => API.get('/monitoring?type=health'),
  
  // 詳細システム情報（管理者のみ）
  getSystemInfo: () => API.get('/monitoring/system'),
};

// --- 履歴関連 API ---
const historyAPI = {
  getUserHistory: async (limit: number = 10, userId?: string) => {
    try {
      logger.info(`[API] 履歴取得リクエスト: limit=${limit}, userId=${userId || 'current user'}`);
      
      const params: { limit: number; userId?: string } = { limit };
      if (userId) params.userId = userId;
      
      const response = await API.get('/history', { 
        params
      });
      
      logger.debug(`[API] 履歴取得レスポンス:`, response.data);
      
      if (!response.data) {
        throw new Error('履歴データが空です');
      }
      
      return {
        success: true,
        message: '履歴を取得しました',
        count: response.data.count || 0,
        history: response.data.data || response.data.history || []
      };
    } catch (error: unknown) {
      const handledError = ErrorHandler.handleApiError(error, '履歴取得');
      logger.error(`[API] Get history error:`, ErrorHandler.getUserFriendlyMessage(handledError));
      return {
        success: false,
        message: ErrorHandler.getUserFriendlyMessage(handledError),
        count: 0,
        history: []
      };
    }
  },
  
  getHistoryDetail: async (historyId: string) => {
    try {
      const response = await API.get(`/history/${historyId}`);
      return response.data;
    } catch (error: unknown) {
      const handledError = ErrorHandler.handleApiError(error, '履歴詳細取得');
      logger.error(`[API] Get history detail error:`, ErrorHandler.getUserFriendlyMessage(handledError));
      throw handledError;
    }
  }
};

// API型定義は types/index.ts に移動済み

// 必要なものだけを最後にまとめてエクスポート
export { API, authAPI, userAPI, problemsAPI, rankingAPI, historyAPI, adminAPI, monitoringAPI, testBackendConnection };

// 管理者統計関連のAPI関数 - 統合エンドポイント使用
export const getOverview = () => API.get('/admin-stats?type=overview');
export const getDifficultyStats = (period: string = 'week') => API.get(`/admin-stats?type=difficulty&period=${period}`);
export const getGradeStats = (period: string = 'week') => API.get(`/admin-stats?type=grade&period=${period}`);
export const getHourlyStats = (days: number = 7) => API.get(`/admin-stats?type=hourly&days=${days}`);


// システム監視関連 - 統合エンドポイント使用
export const getSystemHealth = () => API.get('/monitoring?type=health');
export const getPerformanceStats = () => API.get('/monitoring?type=performance'); 