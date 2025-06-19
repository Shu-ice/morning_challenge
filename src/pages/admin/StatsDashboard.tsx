import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api/index';
import { logger } from '../../utils/logger';
import { getGradeDisplayName, getGradeColor } from '../../utils/gradeUtils';
import { ErrorHandler } from '../../utils/errorHandler';
import type { AdminUser } from '../../types/admin';

interface GradeStats {
  grade: number;
  userCount: number;
  averageCorrectRate: number;
  totalChallenges: number;
  activeUsers: number;
}

interface ActivityStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  growth: number;
}

const StatsDashboard: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeStats[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadStats();
    
    // 30秒ごとの自動更新
    const interval = setInterval(() => {
      loadStats(false); // サイレント更新
    }, 30000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const loadStats = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }

      const response = await adminAPI.getUsers({ limit: 1000 }); // 全ユーザー取得

      if (response.data.success) {
        const usersData = response.data.data.users;
        setUsers(usersData);
        
        // 学年別統計の計算
        const gradeStatistics = calculateGradeStats(usersData);
        setGradeStats(gradeStatistics);
        
        // アクティビティ統計の計算
        const activity = calculateActivityStats(usersData);
        setActivityStats(activity);
      }

    } catch (err) {
      const handledError = ErrorHandler.handleApiError(err, '統計データ取得');
      logger.error('[StatsDashboard] 統計データ取得エラー:', ErrorHandler.getUserFriendlyMessage(handledError));
      if (showLoading) {
        setError(ErrorHandler.getUserFriendlyMessage(handledError));
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const calculateGradeStats = (users: AdminUser[]): GradeStats[] => {
    const grades = [1, 2, 3, 4, 5, 6, 7, 8];
    
    return grades.map(grade => {
      const gradeUsers = users.filter(u => u.grade === grade);
      const activeUsers = gradeUsers.filter(u => u.totalChallenges > 0);
      
      return {
        grade,
        userCount: gradeUsers.length,
        averageCorrectRate: gradeUsers.length > 0 
          ? Math.round(gradeUsers.reduce((sum, u) => sum + u.averageCorrectRate, 0) / gradeUsers.length)
          : 0,
        totalChallenges: gradeUsers.reduce((sum, u) => sum + u.totalChallenges, 0),
        activeUsers: activeUsers.length
      };
    });
  };

  const calculateActivityStats = (users: AdminUser[]): ActivityStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastMonthAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    const todayActivity = users.filter(u => 
      new Date(u.lastActivity) >= today
    ).length;

    const weekActivity = users.filter(u => 
      new Date(u.lastActivity) >= weekAgo
    ).length;

    const monthActivity = users.filter(u => 
      new Date(u.lastActivity) >= monthAgo
    ).length;

    const lastMonthActivity = users.filter(u => 
      new Date(u.lastActivity) >= lastMonthAgo && new Date(u.lastActivity) < monthAgo
    ).length;

    const growth = lastMonthActivity > 0 
      ? Math.round(((monthActivity - lastMonthActivity) / lastMonthActivity) * 100)
      : 0;

    return {
      today: todayActivity,
      thisWeek: weekActivity,
      thisMonth: monthActivity,
      growth
    };
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('ja-JP');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">📊 統計データを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-xl">❌ {error}</div>
      </div>
    );
  }

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.totalChallenges > 0).length;
  const overallAverage = totalUsers > 0 
    ? Math.round(users.reduce((sum, u) => sum + u.averageCorrectRate, 0) / totalUsers)
    : 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1D1D1F' }}>
          📊 リアルタイム統計ダッシュボード
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            📍 30秒ごと自動更新
          </div>
          <button
            onClick={() => loadStats()}
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            🔄 手動更新
          </button>
        </div>
      </div>

      {/* 全体統計 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          borderRadius: '16px',
          padding: '2rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {formatNumber(totalUsers)}
          </div>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>総ユーザー数</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
          borderRadius: '16px',
          padding: '2rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {formatNumber(activeUsers)}
          </div>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>
            アクティブユーザー ({totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}%)
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #AF52DE 0%, #FF2D92 100%)',
          borderRadius: '16px',
          padding: '2rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {overallAverage}%
          </div>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>全体平均正解率</div>
        </div>

        {activityStats && (
          <div style={{
            background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
            borderRadius: '16px',
            padding: '2rem',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {activityStats.growth > 0 ? '+' : ''}{activityStats.growth}%
            </div>
            <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>月間成長率</div>
          </div>
        )}
      </div>

      {/* アクティビティ統計 */}
      {activityStats && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          marginBottom: '3rem'
        }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
            🔥 アクティビティ統計
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#007AFF', marginBottom: '0.5rem' }}>
                {formatNumber(activityStats.today)}
              </div>
              <div style={{ fontSize: '1rem', color: '#666' }}>今日のアクティブユーザー</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#34C759', marginBottom: '0.5rem' }}>
                {formatNumber(activityStats.thisWeek)}
              </div>
              <div style={{ fontSize: '1rem', color: '#666' }}>今週のアクティブユーザー</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#AF52DE', marginBottom: '0.5rem' }}>
                {formatNumber(activityStats.thisMonth)}
              </div>
              <div style={{ fontSize: '1rem', color: '#666' }}>今月のアクティブユーザー</div>
            </div>
          </div>
        </div>
      )}

      {/* 学年別統計 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
          🎓 学年別詳細統計
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {gradeStats.filter(stat => stat.userCount > 0).map(stat => (
            <div
              key={stat.grade}
              style={{
                background: `linear-gradient(135deg, ${getGradeColor(stat.grade)}22 0%, ${getGradeColor(stat.grade)}11 100%)`,
                border: `2px solid ${getGradeColor(stat.grade)}33`,
                borderRadius: '12px',
                padding: '1.5rem'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{
                  background: getGradeColor(stat.grade),
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  {getGradeDisplayName(stat.grade)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1D1D1F' }}>
                    {formatNumber(stat.userCount)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>ユーザー数</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#34C759' }}>
                    {formatNumber(stat.activeUsers)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>アクティブ</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#AF52DE' }}>
                    {stat.averageCorrectRate}%
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>平均正解率</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#FF9500' }}>
                    {formatNumber(stat.totalChallenges)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>総チャレンジ</div>
                </div>
              </div>

              {/* アクティブ率バー */}
              <div style={{
                marginTop: '1rem',
                background: '#f0f0f0',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    background: getGradeColor(stat.grade),
                    height: '8px',
                    width: stat.userCount > 0 ? `${(stat.activeUsers / stat.userCount) * 100}%` : '0%',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: '#666',
                textAlign: 'center',
                marginTop: '0.5rem'
              }}>
                アクティブ率: {stat.userCount > 0 ? Math.round((stat.activeUsers / stat.userCount) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard; 