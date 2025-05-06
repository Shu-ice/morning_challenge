import axios from 'axios';
// import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { DifficultyRank } from '@/types/difficulty';

// バックエンドAPIの基本URL - Viteのプロキシ設定を利用
const API_BASE_URL = '/api';

// バックエンドAPIの状態を確認
console.log(`[API] Connecting to backend API at: ${API_BASE_URL}`);

// APIクライアントの初期設定
const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000, // 10秒のタイムアウト設定
});

// リクエストインターセプター
API.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // 認証トークンの設定
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[API] Request with token:', config.url);
      
      // トークン情報をデコードしてリクエストに追加（開発用）
      try {
        // JWT形式のtoken（header.payload.signature）からpayload部分をデコード
        const tokenPayload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(tokenPayload));
        
        // デバッグ情報としてトークンに含まれるユーザー情報をログに出力
        if (decodedPayload.username || decodedPayload.sub) {
          console.log(`[API] Token contains user: ${decodedPayload.username || decodedPayload.sub}`);
          
          // ローカルストレージにユーザー情報を保存していない場合は、トークンから取得して保存
          if (!localStorage.getItem('user')) {
            const basicUserInfo = {
              username: decodedPayload.username || decodedPayload.sub,
              id: decodedPayload.id || decodedPayload.userId || decodedPayload.sub
            };
            localStorage.setItem('tokenUser', JSON.stringify(basicUserInfo));
            console.log('[API] Stored basic user info from token');
          }
        }
      } catch (e) {
        // トークンのデコードに失敗しても続行
        console.log('[API] Failed to decode token (not JWT format or invalid)');
      }
    } else {
      console.log('[API] Request without token:', config.url);
    }
    return config;
  },
  (error: any) => {
    console.error('[API] Request configuration error:', error.message);
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
API.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    console.log(`[API] Response from ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error: any) => {
    // ネットワークエラーの詳細な処理
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      console.error(`[API] Network error (${error.code}): ${error.message}`);
      console.error('[API] Please check if the server is running at the correct port (5003)');
      console.error('[API] Command to start server: cd server && cross-env PORT=5003 DISABLE_TIME_CHECK=true MONGODB_MOCK=true node server.js');
    } else if (error.response) {
      // サーバーからのエラーレスポンス
      console.error(`[API] Error ${error.response.status}: ${error.response.data?.message || error.message}`);
      console.error('[API] Response data:', error.response.data);
    } else {
      console.error('[API] Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// --- Axios クライアントテスト関数 ---
// バックエンドが応答しているか確認する
export const testBackendConnection = async () => {
  console.log('[API] Testing backend connection...');
  try {
    const response = await API.get('/');
    console.log('[API] Backend connection successful:', response.data);
    return true;
  } catch (error: any) {
    console.error('[API] Backend connection failed:', error.message);
    return false;
  }
};

// 起動時に自動的にバックエンド接続をテスト
setTimeout(() => {
  testBackendConnection().then(isConnected => {
    if (isConnected) {
      console.log('[API] Application ready: backend is connected');
    } else {
      console.warn('[API] Application warning: backend connection failed');
    }
  });
}, 1000);

// --- 認証関連 API ---
export const authAPI = {
  register: async (userData: any) => {
    try {
      console.log('[API] Register request:', userData);
      
      // email/username の両方のフィールドを送信してバックエンドの柔軟性を確保
      const processedData = {
        ...userData,
        email: userData.email,
        username: userData.username || userData.email // usernameがない場合はemailを使用
      };
      
      const response = await API.post('/auth/register', processedData);
      console.log('[API] Register response:', response.data);
      
      // 登録成功時もトークンをローカルストレージに保存
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log('[API] Token saved to localStorage after registration');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[API] Register error:', error.message);
      throw error;
    }
  },
  
  login: async (credentials: any) => {
    try {
      console.log('[API] Login request:', credentials);
      
      // サーバーが両方のフィールドに対応できるように、email/usernameの両方を送信
      const loginData = {
        username: credentials.email || credentials.username,
        email: credentials.email || credentials.username,
        password: credentials.password
      };
      
      const response = await API.post('/auth/login', loginData);
      console.log('[API] Login response:', response.data);
      
      // ログイン成功時にトークンをローカルストレージに保存
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log('[API] Token saved to localStorage');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[API] Login error:', error.message);
      throw error;
    }
  },
  
  updatePassword: async (passwordData: { currentPassword: string, newPassword: string }) => {
    try {
      const response = await API.put('/auth/update-password', passwordData);
      return response.data;
    } catch (error: any) {
      console.error('[API] Update password error:', error.message);
      throw error;
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('[API] User logged out, token removed');
  },
};

// --- ユーザー関連 API (プロフィール取得/更新など) ---
// ★ login/logout を削除 (authAPI に移動想定)
export const userAPI = {
  // register: (userData: any) => API.post('/users/register', userData), // 削除
  // login: (credentials: any) => API.post('/users/login', credentials), // 削除
  // logout: () => API.post('/users/logout'), // 削除
  getProfile: () => API.get('/users/profile'),
  updateProfile: (userData: any) => API.put('/users/profile', userData)
};

// --- 問題関連 API ---
export const problemsAPI = {
  getProblems: async (difficulty: DifficultyRank, date?: string) => {
    try {
      console.log(`[API] 問題取得リクエスト: difficulty=${difficulty}, date=${date || '今日'}`);
      
      // ユーザー情報の取得をより堅牢に
      let userId = null;
      try {
        const userDataStr = localStorage.getItem('user');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          // 複数の可能なID形式に対応
          userId = userData.userId || userData._id || userData.id;
          
          if (!userId) {
            console.warn('[API] ユーザー情報にIDが見つかりません:', userData);
            // ユーザー名をログに出力（デバッグ用）
            console.log('[API] Username:', userData.username);
          } else {
            console.log(`[API] ユーザーID: ${userId}`);
          }
        } else {
          console.warn('[API] ユーザー情報がlocalStorageにありません');
        }
      } catch (parseError) {
        console.error('[API] ユーザー情報の解析エラー:', parseError);
      }
      
      // クエリパラメータを設定
      const params: any = { difficulty };
      if (date) params.date = date;
      // userIdがある場合のみパラメータに含める
      if (userId) {
        params.userId = userId;
        console.log(`[API] ユーザーIDをパラメータに含めます: ${userId}`);
      }
      
      console.log(`[API] 問題取得パラメータ:`, params);
      
      const response = await API.get('/problems', { 
        params,
        timeout: 15000 // タイムアウトを15秒に設定
      });
      
      console.log(`[API] 問題取得レスポンス:`, response.data);
      
      // API応答がない場合や形式が異なる場合に対応
      if (!response.data) {
        throw new Error('API応答が空です');
      }
      
      // 応答データの標準化
      const problems = response.data.data || response.data.problems || [];
      
      // 問題がない場合の処理
      if (!problems || problems.length === 0) {
        console.warn(`[API] 問題が見つかりませんでした: ${date}, ${difficulty}`);
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
    } catch (error: any) {
      console.error(`[API] Get problems error:`, error);
      
      // エラーレスポンスを整形
      let errorMessage = '問題の取得に失敗しました。';
      
      if (error.response) {
        // サーバーからのエラーレスポンス
        errorMessage = error.response.data?.message || error.response.data?.error || `サーバーエラー (${error.response.status})`;
      } else if (error.request) {
        // リクエストは送信されたが、レスポンスがない
        errorMessage = 'サーバーからの応答がありません。ネットワーク接続を確認してください。';
      } else {
        // リクエスト設定時のエラー
        errorMessage = error.message || '予期せぬエラーが発生しました。';
      }
      
      const errorResponse = {
        success: false,
        message: errorMessage,
        problems: []
      };
      
      console.error(`[API] 問題取得エラーレスポンス:`, errorResponse);
      return errorResponse; // エラー時はスローせず、エラーレスポンスを返す
    }
  },
  
  submitAnswers: async (data: {
    difficulty: string,
    date: string,
    answers: string[],
    timeSpent: number,
    userId?: string // userId を任意パラメータとして定義
  }) => {
    try {
      console.log(`[API] 回答を提出します:`, data);
      
      // リクエストを送信する前に、有効なトークンがあるか確認
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('[API] 認証トークンがありません。結果を保存できない可能性があります。');
      }
      
      // ユーザーIDを取得（新しいアプローチ - userIdを優先）
      let userId = null;
      let username = null;
      
      try {
        // 1. JWTトークンから取得を試みる
        if (token) {
          try {
            const tokenPayload = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(tokenPayload));
            userId = decodedPayload.userId || decodedPayload.id || decodedPayload.sub;
            if (userId) {
              console.log(`[API] トークンからユーザーID取得: ${userId}`);
            }
          } catch (e) {
            console.log('[API] Failed to decode token (not JWT format or invalid)');
          }
        }
        
        // 2. ローカルストレージから 'user' キーでユーザー情報を取得
        if (!userId) {
          const userDataStr = localStorage.getItem('user');
          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            // ユーザーIDを優先的に取得
            userId = userData.userId || userData._id || userData.id;
            // バックアップ用にusernameも保持
            username = userData.username;
            
            if (userId) {
              console.log(`[API] ローカルストレージからユーザーID取得: ${userId}`);
            } else if (username) {
              console.log(`[API] ローカルストレージからusername取得: ${username}`);
            } else {
              console.warn('[API] ユーザー情報にIDもusernameも見つかりません:', userData);
            }
          } else {
            console.warn('[API] ユーザー情報がlocalStorageの"user"にありません');
            
            // 3. 代替ストレージから取得を試みる
            const tokenUserStr = localStorage.getItem('tokenUser');
            if (tokenUserStr) {
              const tokenUser = JSON.parse(tokenUserStr);
              userId = tokenUser.id || tokenUser.userId;
              username = tokenUser.username;
              console.log(`[API] tokenUserからID取得: ${userId}`);
            } else {
              // 4. その他のストレージキーから取得を試みる
              const altUserInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
              if (altUserInfo) {
                try {
                  const altData = JSON.parse(altUserInfo);
                  userId = altData.id || altData.userId || altData._id;
                  username = altData.username || altData.email;
                  console.log(`[API] 代替ソースからID取得: ${userId}`);
                } catch (e) {
                  console.error('[API] 代替ユーザー情報の解析エラー:', e);
                }
              }
            }
          }
        }
      } catch (parseError) {
        console.error('[API] ユーザー情報の解析エラー:', parseError);
      }
      
      // 送信データを構築する - userIdを優先、バックアップとしてusernameも送信
      const submissionData: {
        difficulty: string;
        date: string;
        answers: string[];
        timeSpent: number;
        userId?: string;
        username?: string;
      } = {
        ...data,
        userId: userId || data.userId // リクエストのuserIdかローカルで取得したuserIdを使用
      };
      
      // usernameをバックアップとして追加（両方ないとサーバーでエラーになるため）
      if (!submissionData.userId && username) {
        submissionData.username = username;
        console.log(`[API] userIdが取得できないため、usernameをバックアップとして使用: ${username}`);
      }
      
      // どちらも取得できなかった場合のフォールバック - 匿名ユーザー
      if (!submissionData.userId && !submissionData.username) {
        submissionData.username = 'anonymous-' + Math.floor(Math.random() * 10000);
        console.warn(`[API] ユーザー識別子が見つかりません。一時的な識別子を生成: ${submissionData.username}`);
      }
      
      console.log(`[API] 送信データ:`, submissionData);
      
      // 認証トークンが既にリクエストに添付されるため、
      // ユーザーIDはレスポンスの代替表示用に残します
      const response = await API.post('/problems/submit', submissionData);
      console.log(`[API] 回答提出レスポンス:`, response);
      
      // レスポンスの形式を確認し、一貫したオブジェクトを返す
      if (!response || !response.data) {
        console.warn('[API] 回答提出: レスポンスデータが空です');
        return { 
          success: false, 
          message: 'サーバーからの応答が空です', 
          results: null 
        };
      }
      
      // レスポンスがdata.dataという形式の場合に対応
      if (response.data.data && !response.data.success) {
        return {
          success: true,
          message: response.data.message || '回答を提出しました',
          results: response.data.data
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error(`[API] Submit answers error:`, error);
      
      // エラーレスポンスを整形して返す
      let errorMsg = '回答の提出に失敗しました';
      
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      console.error(`[API] エラーメッセージ: ${errorMsg}`);
      
      return {
        success: false,
        message: errorMsg,
        results: null
      };
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
      console.error(`[API] Generate problems error:`, error);
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
      console.error(`[API] Get problems for edit error:`, error);
      throw error;
    }
  },
  
  saveEditedProblems: async (data: {
    date: string,
    difficulty: DifficultyRank,
    problems: any[]
  }) => {
    try {
      const response = await API.post('/problems/edit', data);
      return response.data;
    } catch (error) {
      console.error(`[API] Save edited problems error:`, error);
      throw error;
    }
  },

  getHistory: async () => {
    try {
      // ユーザーIDを取得（新しいアプローチ - userIdを優先）
      let userId = null;
      let username = null;
      
      try {
        // 1. JWTトークンから取得を試みる
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const tokenPayload = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(tokenPayload));
            userId = decodedPayload.userId || decodedPayload.id || decodedPayload.sub;
            if (userId) {
              console.log(`[API] トークンからユーザーID取得: ${userId}`);
            }
          } catch (e) {
            console.log('[API] Failed to decode token (not JWT format or invalid)');
          }
        }
        
        // 2. ローカルストレージから 'user' キーでユーザー情報を取得
        if (!userId) {
          const userDataStr = localStorage.getItem('user');
          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            // ユーザーIDを優先的に取得
            userId = userData.userId || userData._id || userData.id;
            // バックアップ用にusernameも保持
            username = userData.username;
          }
        }
      } catch (error) {
        console.error('[API] ユーザー情報の解析エラー:', error);
      }
      
      // クエリパラメータを構築
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (username) params.append('username', username);
      
      // まず /api/history を試す
      try {
        console.log(`[API] 履歴取得リクエスト /api/history: userId=${userId}, username=${username}`);
        const response = await API.get(`/history?${params.toString()}`);
        
        if (response.data && response.data.success) {
          console.log('[API] 履歴取得成功 (/api/history):', response.data);
          return response.data;
        } else {
          console.warn('[API] /api/history からの応答が不正:', response.data);
          throw new Error('履歴取得レスポンスが不正です');
        }
      } catch (firstError) {
        console.warn('[API] /api/history からの履歴取得に失敗。バックアップを試みます:', firstError);
        
        // バックアップとして /api/problems/history を試す
        console.log(`[API] 履歴取得リクエスト /api/problems/history: userId=${userId}, username=${username}`);
        const backupResponse = await API.get(`/problems/history?${params.toString()}`);
        
        if (!backupResponse.data || !backupResponse.data.success) {
          console.error('[API] バックアップ履歴取得にも失敗:', backupResponse.data);
          throw new Error(backupResponse.data?.message || '履歴の取得に失敗しました');
        }
        
        console.log('[API] バックアップから履歴取得成功:', backupResponse.data);
        return backupResponse.data;
      }
    } catch (error) {
      console.error('履歴取得エラー:', error);
      throw error;
    }
  }
};

export const rankingAPI = {
  getAll: (limit: number = 10, difficulty?: DifficultyRank) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (difficulty) params.append('difficulty', difficulty);
    return API.get(`/rankings?${params.toString()}`);
  },
  getDaily: async (limit: number = 10, difficulty?: DifficultyRank) => {
    try {
      console.log(`[API] ランキング取得リクエスト: difficulty=${difficulty || 'すべて'}, limit=${limit}`);
      
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (difficulty) params.append('difficulty', difficulty);
      
      // トークンがあるか確認（認証済みユーザーのみランキング取得可能）
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('[API] 認証トークンがありません。ランキング取得に失敗する可能性があります。');
      }
      
      const response = await API.get(`/rankings/daily?${params.toString()}`);
      console.log(`[API] ランキング取得レスポンス:`, response.data);
      
      if (!response.data) {
        throw new Error('ランキングデータが空です');
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error(`[API] Get rankings error:`, error);
      return {
        success: false,
        message: error.response?.data?.message || 'ランキングの取得に失敗しました',
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

// 管理者API (例)
export const adminAPI = {
  generateProblems: (date: string) => API.post(`/admin/generate-problems/${date}`),
  // 必要に応じて他の管理者用APIエンドポイントを追加
};

// --- 履歴関連 API ---
export const historyAPI = {
  getUserHistory: async (limit: number = 10) => {
    try {
      console.log(`[API] 履歴取得リクエスト`);
      
      const response = await API.get('/history', { 
        params: { limit }
      });
      
      console.log(`[API] 履歴取得レスポンス:`, response.data);
      
      if (!response.data) {
        throw new Error('履歴データが空です');
      }
      
      return {
        success: true,
        message: '履歴を取得しました',
        history: response.data.data || response.data.history || []
      };
    } catch (error: any) {
      console.error(`[API] Get history error:`, error);
      return {
        success: false,
        message: error.response?.data?.message || '履歴の取得に失敗しました',
        history: []
      };
    }
  },
  
  getHistoryDetail: async (historyId: string) => {
    try {
      const response = await API.get(`/history/${historyId}`);
      return response.data;
    } catch (error) {
      console.error(`[API] Get history detail error:`, error);
      throw error;
    }
  }
};

export default API; 