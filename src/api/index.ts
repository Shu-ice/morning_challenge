import axios from 'axios';

// APIクライアントの初期設定
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// リクエストインターセプター：認証トークンを設定
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ユーザー関連API
export const userAPI = {
  register: (userData: any) => API.post('/users/register', userData),
  login: (credentials: any) => API.post('/users/login', credentials),
  logout: () => API.post('/users/logout'),
  getProfile: () => API.get('/users/profile'),
  updateProfile: (userData: any) => API.put('/users/profile', userData)
};

// 問題関連API
export const problemAPI = {
  getProblems: (grade: number, skipTimeCheck: boolean = false) => 
    API.get(`/problems?grade=${grade}${skipTimeCheck ? '&skipTimeCheck=true' : ''}`),
  submitAnswers: (data: any) => API.post('/problems/submit', data),
  getHistory: () => API.get('/problems/history')
};

// ダミーデータ
const dummyRankings = [
  { _id: '1', username: 'ユーザー1', grade: 3, points: 100, streak: 5, avatar: '👦' },
  { _id: '2', username: 'ユーザー2', grade: 4, points: 90, streak: 3, avatar: '👧' },
  { _id: '3', username: 'ユーザー3', grade: 5, points: 80, streak: 2, avatar: '👦' },
  { _id: '4', username: 'ユーザー4', grade: 6, points: 70, streak: 1, avatar: '👧' },
  { _id: '5', username: 'ユーザー5', grade: 3, points: 60, streak: 1, avatar: '👦' },
];

export const rankingAPI = {
  getAll: (limit: number = 10) => API.get(`/rankings?limit=${limit}`),
  getDaily: (limit: number = 10) => API.get(`/rankings/daily?limit=${limit}`),
  getWeekly: (limit: number = 10) => API.get(`/rankings/weekly?limit=${limit}`),
  getMonthly: (limit: number = 10) => API.get(`/rankings/monthly?limit=${limit}`),
  getByGrade: (grade: number, limit: number = 10) => 
    API.get(`/rankings/grade/${grade}?limit=${limit}`),
  getRankings: async () => {
    // 実際のAPI呼び出しの代わりにダミーデータを返す
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(dummyRankings);
      }, 1000);
    });
  }
};

export default API; 