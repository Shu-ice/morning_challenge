// APIとの通信を行うサービス
const API_URL = 'http://localhost:5000/api';

// ローカルストレージからトークンを取得
const getToken = () => {
  return localStorage.getItem('userToken');
};

// 認証ヘッダーを作成
const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ユーザー登録
export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'ユーザー登録に失敗しました');
    }
    
    // ログイン情報をローカルストレージに保存
    if (data.token) {
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
};

// ユーザーログイン
export const loginUser = async (credentials) => {
  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'ログインに失敗しました');
    }
    
    // ログイン情報をローカルストレージに保存
    if (data.token) {
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// ログアウト
export const logoutUser = () => {
  localStorage.removeItem('userToken');
  localStorage.removeItem('userData');
};

// ユーザープロフィール取得
export const getUserProfile = async () => {
  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: 'GET',
      headers: {
        ...authHeader(),
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'プロフィール取得に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Get profile error:', error);
    throw error;
  }
};

// ユーザープロフィール更新
export const updateUserProfile = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(userData),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'プロフィール更新に失敗しました');
    }
    
    // 更新された情報をローカルストレージに保存
    if (data.token) {
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};

// 問題取得
export const getProblems = async () => {
  try {
    const response = await fetch(`${API_URL}/problems`, {
      method: 'GET',
      headers: {
        ...authHeader(),
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '問題の取得に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Get problems error:', error);
    throw error;
  }
};

// 問題解答を提出
export const submitAnswers = async (answersData) => {
  try {
    const response = await fetch(`${API_URL}/problems/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(answersData),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '解答の提出に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Submit answers error:', error);
    throw error;
  }
};

// 履歴取得
export const getProblemHistory = async (limit = 10) => {
  try {
    const response = await fetch(`${API_URL}/problems/history?limit=${limit}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '履歴の取得に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Get history error:', error);
    throw error;
  }
};

// 日間ランキング取得
export const getDailyRankings = async (grade = null) => {
  try {
    const gradeParam = grade ? `?grade=${grade}` : '';
    const response = await fetch(`${API_URL}/rankings/daily${gradeParam}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'ランキングの取得に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Get daily rankings error:', error);
    throw error;
  }
};

// 週間ランキング取得
export const getWeeklyRankings = async (grade = null) => {
  try {
    const gradeParam = grade ? `?grade=${grade}` : '';
    const response = await fetch(`${API_URL}/rankings/weekly${gradeParam}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'ランキングの取得に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Get weekly rankings error:', error);
    throw error;
  }
};

// 月間ランキング取得
export const getMonthlyRankings = async (grade = null) => {
  try {
    const gradeParam = grade ? `?grade=${grade}` : '';
    const response = await fetch(`${API_URL}/rankings/monthly${gradeParam}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'ランキングの取得に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Get monthly rankings error:', error);
    throw error;
  }
};

// 自分のランキング取得
export const getUserRanking = async (score = 0) => {
  try {
    const response = await fetch(`${API_URL}/rankings/me?score=${score}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'ランキングの取得に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Get user ranking error:', error);
    throw error;
  }
};

// アイテム購入
export const purchaseItem = async (itemId) => {
  try {
    const response = await fetch(`${API_URL}/users/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ itemId }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'アイテム購入に失敗しました');
    }
    
    return data;
  } catch (error) {
    console.error('Purchase item error:', error);
    throw error;
  }
};
