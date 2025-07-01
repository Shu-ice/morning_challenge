import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI, monitoringAPI } from '@/api/index';
import { logger } from '@/utils/logger';
import '@/styles/AdminLayout.css';
import { getGradeLabel } from '../../utils/gradeUtils';
import { formatTime } from '../../utils/dateUtils';
import type { 
  SystemOverview, 
  DifficultyStats, 
  GradeStats, 
  HourlyStats,
  SystemHealth,
  PerformanceStats
} from '../../types/admin';

interface StatsCard {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [difficultyStats, setDifficultyStats] = useState<DifficultyStats[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [activitySearchTerm, setActivitySearchTerm] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔄 [AdminDashboard] データ取得開始 - 個別API使用');
        
        // 個別APIを並列取得
        const [
          overviewResponse,
          difficultyResponse,
          gradeResponse,
          hourlyResponse,
          healthResponse,
          performanceResponse
        ] = await Promise.allSettled([
          adminAPI.getOverview(),
          adminAPI.getDifficultyStats('week'),
          adminAPI.getGradeStats('week'),
          adminAPI.getHourlyStats(7),
          monitoringAPI.getSystemHealth(),
          monitoringAPI.getPerformanceStats()
        ]);

        // 各レスポンスを処理
        if (overviewResponse.status === 'fulfilled') {
          setOverview(overviewResponse.value.data.data || {});
        }

        if (difficultyResponse.status === 'fulfilled') {
          const difficultyData = difficultyResponse.value.data.data;
          setDifficultyStats(difficultyData?.stats || []);
        }

        if (gradeResponse.status === 'fulfilled') {
          const gradeData = gradeResponse.value.data.data;
          setGradeStats(gradeData?.stats || []);
        }

        if (hourlyResponse.status === 'fulfilled') {
          const hourlyData = hourlyResponse.value.data.data;
          setHourlyStats(hourlyData?.stats || []);
        }

        if (healthResponse.status === 'fulfilled') {
          setSystemHealth(healthResponse.value.data || {});
        }

        if (performanceResponse.status === 'fulfilled') {
          setPerformanceStats(performanceResponse.value.data || {});
        }

        console.log('✅ [AdminDashboard] 全データ取得完了');

      } catch (error: any) {
        console.error('❌ [AdminDashboard] データ取得エラー:', error);
        setError(`データの取得に失敗しました: ${error.message}`);
        
        // エラー時のフォールバックデータ
        setOverview({
          totalUsers: 0,
          activeUsersToday: 0,
          totalChallenges: 0,
          challengesToday: 0,
          problemSetsCount: 0,
          recentActivity: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('ja-JP').format(num);
  };

  const difficultyColors: Record<string, string> = {
    beginner: '#34C759',
    intermediate: '#007AFF', 
    advanced: '#FF9500',
    expert: '#FF3B30'
  };

  const difficultyLabels: Record<string, string> = {
    beginner: '初級',
    intermediate: '中級',
    advanced: '上級',
    expert: '超級'
  };

  const getHealthStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#34C759';
      case 'warning': return '#FF9500';
      case 'unhealthy': return '#FF3B30';
      case 'degraded': return '#AF52DE';
      default: return '#8E8E93';
    }
  };

  const getHealthStatusIcon = (status: string): string => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'unhealthy': return '❌';
      case 'degraded': return '🟡';
      default: return '❓';
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}日 ${hours}時間`;
    } else if (hours > 0) {
      return `${hours}時間 ${minutes}分`;
    } else {
      return `${minutes}分`;
    }
  };

  // アクティビティをフィルタリングする関数を追加
  const getFilteredActivity = () => {
    if (!overview?.recentActivity) return [];
    
    if (!activitySearchTerm.trim()) {
      return overview.recentActivity;
    }
    
    return overview.recentActivity.filter(activity =>
      activity.username.toLowerCase().includes(activitySearchTerm.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">📊 ダッシュボードを読み込み中...</div>
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

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1D1D1F' }}>
          📊 管理者ダッシュボード
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'today' | 'week' | 'month')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '1rem'
            }}
          >
            <option value="today">今日</option>
            <option value="week">過去7日間</option>
            <option value="month">過去30日間</option>
          </select>
          
          <button
            onClick={() => {
              // Implement the logic to refresh the dashboard
            }}
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            🔄 更新
          </button>
        </div>
      </div>

      {/* システム概要カード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          borderRadius: '16px',
          padding: '1.5rem',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{formatNumber(overview?.totalUsers || 0)}</div>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>👥 総ユーザー数</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
            本日アクティブ: {overview?.activeUsersToday || 0}人
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
          borderRadius: '16px',
          padding: '1.5rem',
          color: 'white',
          boxShadow: '0 8px 32px rgba(52, 199, 89, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{formatNumber(overview?.totalChallenges || 0)}</div>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>🎯 総チャレンジ数</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
            本日: {overview?.challengesToday || 0}回
          </div>
        </div>
      
      <div style={{ 
          background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
          borderRadius: '16px',
          padding: '1.5rem',
          color: 'white',
          boxShadow: '0 8px 32px rgba(255, 149, 0, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{formatNumber(overview?.problemSetsCount || 0)}</div>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>📚 問題セット数</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
            システム全体
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #AF52DE 0%, #FF2D92 100%)',
          borderRadius: '16px',
          padding: '1.5rem',
          color: 'white',
          boxShadow: '0 8px 32px rgba(175, 82, 222, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
            {overview && overview.weeklyStats && overview.weeklyStats.length > 0 
              ? Math.round(overview.weeklyStats.reduce((sum, day) => sum + day.averageCorrectRate, 0) / overview.weeklyStats.length)
              : 0
            }%
          </div>
          <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>⭐ 週間平均正解率</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
            過去7日間
          </div>
        </div>
      </div>

      {/* 難易度別統計 */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
          📈 難易度別統計 ({selectedPeriod === 'today' ? '今日' : selectedPeriod === 'week' ? '過去7日間' : '過去30日間'})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {difficultyStats.map((stat) => (
            <div key={stat.difficulty} style={{
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: `3px solid ${difficultyColors[stat.difficulty] || '#gray'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: difficultyColors[stat.difficulty] }}>
                  {difficultyLabels[stat.difficulty] || stat.difficulty}
                </h3>
                <div style={{ 
                  background: difficultyColors[stat.difficulty],
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.9rem'
                }}>
                  {stat.uniqueUsers}人
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                <div>
                  <div style={{ color: '#666' }}>総チャレンジ数</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{formatNumber(stat.totalChallenges)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>平均正解率</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stat.averageCorrectRate || 0}%</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>平均時間</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{formatTime(stat.averageTime * 1000)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>平均正解数</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{stat.averageCorrectAnswers}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 学年別統計 */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
          🎓 学年別統計 ({selectedPeriod === 'today' ? '今日' : selectedPeriod === 'week' ? '過去7日間' : '過去30日間'})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {gradeStats.map((stat) => {
            // 学年表示名の決定（共通ユーティリティを使用）
            const gradeDisplay = getGradeLabel(stat.grade);
            
            // 学年別カラー設定（新学年システム対応：1-15, 99）
            const gradeColors = {
              1: '#FF6B6B',   // 小学1年生
              2: '#4ECDC4',   // 小学2年生
              3: '#45B7D1',   // 小学3年生
              4: '#96CEB4',   // 小学4年生
              5: '#FECA57',   // 小学5年生
              6: '#FF9FF3',   // 小学6年生
              7: '#BDC3C7',   // その他
              8: '#E74C3C',   // 中学1年生
              9: '#E67E22',   // 中学2年生
              10: '#F39C12',  // 中学3年生
              11: '#27AE60',  // 高校1年生
              12: '#2ECC71',  // 高校2年生
              13: '#3498DB',  // 高校3年生
              14: '#9B59B6',  // 大学生
              15: '#34495E',  // 社会人
              99: '#6C5CE7'   // ひみつ
            };
            const gradeColor = gradeColors[stat.grade as keyof typeof gradeColors] || '#95A5A6';
            
            return (
              <div key={stat.grade} style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: `3px solid ${gradeColor}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: gradeColor }}>
                    {gradeDisplay}
                  </h3>
                  <div style={{ 
                    background: gradeColor,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.9rem'
                  }}>
                    {stat.uniqueUsers}人
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ color: '#666' }}>総チャレンジ数</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{formatNumber(stat.totalChallenges)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#666' }}>平均正解率</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stat.averageCorrectRate || 0}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#666' }}>平均時間</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{formatTime(stat.averageTime * 1000)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#666' }}>平均正解数</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{(stat.averageCorrectRate / 10).toFixed(1)}</div>
                  </div>
                </div>
                
                {/* 難易度分布 */}
                {stat.difficultyDistribution && Object.keys(stat.difficultyDistribution).length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>難易度分布</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {Object.entries(stat.difficultyDistribution).map(([difficulty, count]) => (
                        <span key={difficulty} style={{
                          background: `${difficultyColors[difficulty as keyof typeof difficultyColors] || '#gray'}20`,
                          color: difficultyColors[difficulty as keyof typeof difficultyColors] || '#gray',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {difficultyLabels[difficulty as keyof typeof difficultyLabels] || difficulty}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* システムヘルス監視 */}
      {systemHealth && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
            🏥 システムヘルス
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div style={{
              background: `linear-gradient(135deg, ${getHealthStatusColor(systemHealth.status || 'unknown')}22 0%, ${getHealthStatusColor(systemHealth.status || 'unknown')}44 100%)`,
              borderRadius: '16px',
              padding: '1.5rem',
              border: `2px solid ${getHealthStatusColor(systemHealth.status || 'unknown')}`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>{getHealthStatusIcon(systemHealth.status || 'unknown')}</div>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: getHealthStatusColor(systemHealth.status || 'unknown') }}>
                    {(systemHealth.status || 'UNKNOWN').toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>システム全体</div>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                最終更新: {new Date(systemHealth.timestamp).toLocaleString('ja-JP')}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '1rem', color: '#007AFF' }}>
                🕐 システム稼働時間
              </h3>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#1D1D1F' }}>
                {systemHealth.system ? formatUptime(systemHealth.system.uptime) : 'N/A'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                {systemHealth.system ? `Node.js ${systemHealth.system.nodeVersion}` : ''}
              </div>
            </div>

            {performanceStats?.global && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '1rem', color: '#34C759' }}>
                  ⚡ パフォーマンス
                </h3>
                <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#1D1D1F' }}>
                  {performanceStats?.global?.averageResponseTime !== undefined ? `${performanceStats.global.averageResponseTime.toFixed(1)}ms` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                  平均応答時間
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                  総リクエスト: {performanceStats?.global?.totalRequests !== undefined ? performanceStats.global.totalRequests.toLocaleString() : 'N/A'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 管理ツール */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
          🛠️ 管理ツール
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <Link 
            to="/admin/users"
            style={{
              display: 'block',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 0.2s ease'
            }}
            className="hover:scale-105"
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#007AFF' }}>
              👥 ユーザー管理
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              ユーザー一覧の表示、検索、詳細情報の確認ができます。
            </p>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              ユーザー管理画面へ
            </div>
          </Link>

          <Link 
            to="/admin/stats"
            style={{
              display: 'block',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 0.2s ease'
            }}
            className="hover:scale-105"
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#34C759' }}>
              📊 リアルタイム統計
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              ユーザー活動、学年別統計、成長率など詳細な分析データを表示します。
            </p>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              統計ダッシュボードへ
            </div>
          </Link>

          <Link 
            to="/admin/generate"
            style={{
              display: 'block',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 0.2s ease'
            }}
            className="hover:scale-105"
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#34C759' }}>
              ⚡ 問題生成
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              指定した日付と難易度の問題セットを生成します。
            </p>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              問題生成ツール
            </div>
          </Link>

          <Link 
            to="/admin/edit"
            style={{
              display: 'block',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 0.2s ease'
            }}
            className="hover:scale-105"
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#FF9500' }}>
              ✏️ 問題編集
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              既存の問題セットを編集・修正します。
            </p>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              問題編集ツール
            </div>
          </Link>

          {/* 🕒 時間帯設定 */}
          <Link 
            to="/admin/settings"
            style={{
              display: 'block',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 0.2s ease'
            }}
            className="hover:scale-105"
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#007AFF' }}>
              🕒 時間帯設定
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              チャレンジ可能な開始 / 終了時刻を変更します。
            </p>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              設定ページへ
            </div>
          </Link>
        </div>
      </div>

      {/* 最近のアクティビティ */}
      {overview?.recentActivity && overview.recentActivity.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '600', color: '#1D1D1F' }}>
              🔔 最近のアクティビティ（過去24時間）
            </h2>
            
            {/* ユーザー検索ボックス */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="ユーザー名で検索..."
                value={activitySearchTerm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  width: '200px'
                }}
                onChange={(e) => setActivitySearchTerm(e.target.value)}
              />
              <button
                onClick={() => navigate('/admin/users')}
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                👥 ユーザー管理
              </button>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {getFilteredActivity().length > 0 ? (
              getFilteredActivity().map((activity, index) => (
                <div key={activity.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 0',
                  borderBottom: index < getFilteredActivity().length - 1 ? '1px solid #eee' : 'none'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#1D1D1F' }}>
                      {activity.username} ({getGradeLabel(activity.grade)})
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                      {activity.difficulty} - {activity.correctAnswers}/{activity.totalProblems}問正解
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                      📊 {activity.timeSpent > 0 ? formatTime(activity.timeSpent * 1000) : '時間情報なし'} で完了
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'right', minWidth: '120px' }}>
                    <div>{activity.date}</div>
                    <div>
                      {new Date(activity.createdAt).toLocaleTimeString('ja-JP', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#999', 
                padding: '2rem',
                fontSize: '0.9rem'
              }}>
                {activitySearchTerm ? 
                  `「${activitySearchTerm}」に該当するアクティビティが見つかりません` : 
                  'アクティビティがありません'
                }
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 