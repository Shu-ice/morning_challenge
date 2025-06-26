// 管理者機能用の型定義

export interface SystemOverview {
  totalUsers: number;
  activeUsersToday: number;
  totalChallenges: number;
  challengesToday: number;
  problemSetsCount: number;
  weeklyStats?: WeeklyStats[];
  recentActivity?: RecentActivity[];
  difficultyStats?: DifficultyStats[];
  gradeStats?: GradeStats[];
  hourlyStats?: HourlyStats[];
}

export interface WeeklyStats {
  date: string;
  totalChallenges: number;
  averageCorrectRate: number;
  uniqueUsers: number;
}

export interface RecentActivity {
  id: string;
  username: string;
  grade: number | string;
  difficulty: string;
  correctAnswers: number;
  totalProblems: number;
  timeSpent: number;
  date: string;
  createdAt: string;
}

export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  grade: number;
  avatar: string;
  isAdmin: boolean;
  streak: number;
  points: number;
  createdAt: string;
  totalChallenges: number;
  averageCorrectRate: number;
  bestCorrectRate: number;
  lastActivity: string;
}

export interface UserListResponse {
  users: AdminUser[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
  };
}

export interface DifficultyStats {
  difficulty: string;
  totalChallenges: number;
  averageCorrectRate: number;
  averageTime: number;
  averageCorrectAnswers: number;
  uniqueUsers: number;
}

export interface GradeStats {
  grade: number;
  totalChallenges: number;
  averageCorrectRate: number;
  averageTime: number;
  uniqueUsers: number;
  difficultyDistribution: Record<string, number>;
}

export interface HourlyStats {
  hour: number;
  totalChallenges: number;
  averageCorrectRate: number;
  averageTime: number;
  difficultyDistribution: Record<string, number>;
}

export interface ProblemSetStats {
  difficultyBreakdown: DifficultyProblemSetStats[];
  usage: {
    totalProblemSets: number;
    usedProblemSets: number;
    unusedProblemSets: number;
  };
}

export interface DifficultyProblemSetStats {
  difficulty: string;
  totalSets: number;
  averageProblems: number;
  oldestDate: string;
  newestDate: string;
}

export interface StatsFilter {
  period?: 'today' | 'week' | 'month';
  days?: number;
}

export interface UserFilter {
  page?: number;
  limit?: number;
  search?: string;
  grade?: number;
  sortBy?: 'username' | 'createdAt' | 'totalChallenges' | 'averageScore';
  order?: 'asc' | 'desc';
}

// システム監視関連の型定義
export interface PerformanceStats {
  timestamp: string;
  global: {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    requestsPerMinute: number;
  };
  endpoints: EndpointStat[];
  slowestEndpoints: EndpointStat[];
  highErrorEndpoints: EndpointStat[];
  slowQueries: SlowQuery[];
  healthScore: number;
}

export interface EndpointStat {
  endpoint: string;
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errors: number;
  errorRate: number;
  lastRequest: string;
}

export interface SlowQuery {
  requestId: string;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  responseTime: number;
  statusCode: number;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

export interface SystemHealth {
  timestamp: string;
  status: 'healthy' | 'warning' | 'unhealthy' | 'degraded';
  checks: {
    database?: HealthCheck;
    memory?: HealthCheck;
    cpu?: HealthCheck;
    disk?: HealthCheck;
    environment?: HealthCheck;
  };
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'warning' | 'unhealthy' | 'unknown';
  responseTime?: string;
  lastPing?: string;
  error?: string;
  usage?: {
    total?: number;
    used?: number;
    free?: number;
    utilization?: number;
  };
  percentage?: string;
} 