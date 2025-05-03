// ダミーAPIレスポンスを生成するモックAPI
interface UserRanking {
  _id: string;
  username: string;
  avatar: string;
  grade: number;
  points?: number;
  totalScore?: number;
  streak?: number;
  date?: string;
}

interface ApiResponse {
  success: boolean;
  users: UserRanking[];
  message?: string;
}

// ダミーユーザーデータ
const generateDummyUsers = (count: number = 20): UserRanking[] => {
  const avatars = ['😊', '🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🐨', '🦁', '🐯', '🐸', '🐢', '🦉', '🦄'];
  const users: UserRanking[] = [];
  
  for (let i = 0; i < count; i++) {
    users.push({
      _id: `user-${i}`,
      username: `ユーザー${i + 1}`,
      avatar: avatars[i % avatars.length],
      grade: Math.floor(Math.random() * 6) + 1,
      points: Math.floor(Math.random() * 1000),
      streak: Math.floor(Math.random() * 30) + 1
    });
  }
  
  // ポイントの高い順にソート
  return users.sort((a, b) => (b.points || 0) - (a.points || 0));
};

const dailyUsers = generateDummyUsers(15);
const weeklyUsers = generateDummyUsers(20);
const monthlyUsers = generateDummyUsers(30);
const allTimeUsers = generateDummyUsers(50);

// 各学年ごとのユーザーを生成
const gradeUsers: { [key: number]: UserRanking[] } = {};
for (let grade = 1; grade <= 6; grade++) {
  const users = generateDummyUsers(10).map(user => ({
    ...user,
    grade
  }));
  gradeUsers[grade] = users;
}

// APIリクエストのモック
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// APIモジュール
export const rankingAPI = {
  // 全期間のランキングを取得
  getAll: async (): Promise<{ data: ApiResponse }> => {
    await delay(500); // APIレスポンス遅延をシミュレート
    return {
      data: {
        success: true,
        users: allTimeUsers
      }
    };
  },
  
  // デイリーランキングを取得
  getDaily: async (): Promise<{ data: ApiResponse }> => {
    await delay(500);
    return {
      data: {
        success: true,
        users: dailyUsers
      }
    };
  },
  
  // ウィークリーランキングを取得
  getWeekly: async (): Promise<{ data: ApiResponse }> => {
    await delay(500);
    return {
      data: {
        success: true,
        users: weeklyUsers
      }
    };
  },
  
  // マンスリーランキングを取得
  getMonthly: async (): Promise<{ data: ApiResponse }> => {
    await delay(500);
    return {
      data: {
        success: true,
        users: monthlyUsers
      }
    };
  },
  
  // 学年別ランキングを取得
  getByGrade: async (grade: number): Promise<{ data: ApiResponse }> => {
    await delay(500);
    return {
      data: {
        success: true,
        users: gradeUsers[grade] || []
      }
    };
  }
}; 