import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../api/index';
import { logger } from '../../utils/logger';
import type { 
  SystemOverview, 
  DifficultyStats, 
  GradeStats, 
  HourlyStats 
} from '../../types/admin';

interface StatsCard {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon: string;
}

const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [difficultyStats, setDifficultyStats] = useState<DifficultyStats[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, difficultyRes, gradeRes, hourlyRes] = await Promise.all([
        adminAPI.getOverview(),
        adminAPI.getDifficultyStats(selectedPeriod),
        adminAPI.getGradeStats(selectedPeriod),
        adminAPI.getHourlyStats(7)
      ]);

      if (overviewRes.data.success) {
        setOverview(overviewRes.data.data);
      }
      if (difficultyRes.data.success) {
        setDifficultyStats(difficultyRes.data.data.stats);
      }
      if (gradeRes.data.success) {
        setGradeStats(gradeRes.data.data.stats);
      }
      if (hourlyRes.data.success) {
        setHourlyStats(hourlyRes.data.data.stats);
      }

    } catch (err) {
      logger.error('[AdminDashboard] データ取得エラー:', err instanceof Error ? err.message : String(err));
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('ja-JP').format(num);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
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
            onClick={() => loadDashboardData()}
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
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            borderRadius: '16px',
            padding: '1.5rem',
            color: 'white',
            boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3)'
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{formatNumber(overview.totalUsers)}</div>
            <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>👥 総ユーザー数</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
              本日アクティブ: {overview.activeUsersToday}人
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
            borderRadius: '16px',
            padding: '1.5rem',
            color: 'white',
            boxShadow: '0 8px 32px rgba(52, 199, 89, 0.3)'
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{formatNumber(overview.totalChallenges)}</div>
            <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>🎯 総チャレンジ数</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
              本日: {overview.challengesToday}回
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
            borderRadius: '16px',
            padding: '1.5rem',
            color: 'white',
            boxShadow: '0 8px 32px rgba(255, 149, 0, 0.3)'
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{formatNumber(overview.problemSetsCount)}</div>
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
              {overview.weeklyStats.length > 0 
                ? Math.round(overview.weeklyStats.reduce((sum, day) => sum + day.averageScore, 0) / overview.weeklyStats.length)
                : 0
              }
            </div>
            <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>⭐ 週間平均スコア</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
              過去7日間
            </div>
          </div>
        </div>
      )}

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
                  <div style={{ color: '#666' }}>平均スコア</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stat.averageScore}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>平均時間</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{formatTime(stat.averageTime)}</div>
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
          🎓 学年別統計
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {gradeStats.map((stat) => (
            <div key={stat.grade} style={{
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#007AFF' }}>
                {stat.grade}年生
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                {stat.uniqueUsers}人が参加
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                平均: {stat.averageScore}点
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                {formatTime(stat.averageTime)}
              </div>
            </div>
          ))}
        </div>
      </div>

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
        </div>
      </div>

      {/* 最近のアクティビティ */}
      {overview?.recentActivity && overview.recentActivity.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
            🔔 最近のアクティビティ（過去24時間）
          </h2>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {overview.recentActivity.map((activity, index) => (
              <div key={activity.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 0',
                borderBottom: index < overview.recentActivity.length - 1 ? '1px solid #eee' : 'none'
              }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#1D1D1F' }}>
                    {activity.username} ({activity.grade}年生)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {difficultyLabels[activity.difficulty] || activity.difficulty} - {activity.score}点
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'right' }}>
                  <div>{activity.date}</div>
                  <div>
                    {new Date(activity.createdAt).toLocaleTimeString('ja-JP', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 