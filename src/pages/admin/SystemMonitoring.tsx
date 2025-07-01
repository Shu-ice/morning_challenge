import React, { useState, useEffect } from 'react';
import { monitoringAPI } from '../../api/index';
import { logger } from '../../utils/logger';
import type { PerformanceStats, SystemHealth } from '../../types/admin';

const SystemMonitoring: React.FC = () => {
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadMonitoringData();
    
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(loadMonitoringData, 30000); // 30秒ごとに更新
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);

      // health APIは503エラーの可能性があるため個別に処理
      let healthRes = null;
      let performanceRes = null;
      
      try {
        healthRes = await monitoringAPI.getSystemHealth();
      } catch (healthError) {
        logger.warn('[SystemMonitoring] Health API エラー:', healthError instanceof Error ? healthError : String(healthError));
        // 503エラーの場合は degraded として扱う
        healthRes = {
          data: {
            success: true,
            data: {
              status: 'degraded',
              timestamp: new Date().toISOString(),
              system: {
                uptime: 0,
                nodeVersion: 'N/A'
              },
              checks: {
                database: { status: 'unknown', responseTime: 'N/A' },
                memory: { status: 'unknown', percentage: 'N/A' },
                disk: { status: 'unknown', percentage: 'N/A' }
              }
            }
          }
        };
      }

      try {
        performanceRes = await monitoringAPI.getPerformanceStats();
      } catch (performanceError) {
        logger.warn('[SystemMonitoring] Performance API エラー:', performanceError instanceof Error ? performanceError : String(performanceError));
        performanceRes = { data: { success: false } };
      }

      if (performanceRes.data.success) {
        setPerformanceStats(performanceRes.data.data);
      }
      if (healthRes.data.success) {
        setSystemHealth(healthRes.data.data);
      }

    } catch (err) {
      logger.error('[SystemMonitoring] データ取得エラー:', err instanceof Error ? err.message : String(err));
      setError('<ruby>監視<rt>かんし</rt></ruby>データの<ruby>取得<rt>しゅとく</rt></ruby>に<ruby>失敗<rt>しっぱい</rt></ruby>しました');
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}日 ${hours}時間 ${minutes}分`;
    } else if (hours > 0) {
      return `${hours}時間 ${minutes}分`;
    } else {
      return `${minutes}分`;
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100}${sizes[i]}`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#34C759';
      case 'warning': return '#FF9500';
      case 'unhealthy': return '#FF3B30';
      case 'degraded': return '#AF52DE';
      default: return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'unhealthy': return '❌';
      case 'degraded': return '🟡';
      default: return '❓';
    }
  };

  if (loading && !performanceStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">📊 システム監視データを読み込み中...</div>
      </div>
    );
  }

  if (error && !performanceStats) {
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
          🖥️ システム監視
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自動更新 (30秒)
          </label>
          
          <button
            onClick={() => loadMonitoringData()}
            disabled={loading}
            style={{
              background: loading ? '#d1d5db' : 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {loading ? '🔄 更新中...' : '🔄 手動更新'}
          </button>
        </div>
      </div>

      {/* システムヘルス概要 */}
      {systemHealth && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
            🏥 システムヘルス
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${getStatusColor(systemHealth.status)}22 0%, ${getStatusColor(systemHealth.status)}44 100%)`,
              borderRadius: '16px',
              padding: '1.5rem',
              border: `2px solid ${getStatusColor(systemHealth.status)}`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>{getStatusIcon(systemHealth.status)}</div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: getStatusColor(systemHealth.status) }}>
                    {systemHealth.status.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>全体ステータス</div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
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
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1D1D1F' }}>
                {formatUptime(systemHealth.system.uptime)}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Node.js {systemHealth.system.nodeVersion}
              </div>
            </div>
          </div>

          {/* ヘルスチェック詳細 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {Object.entries(systemHealth.checks).map(([component, check]) => (
              <div key={component} style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '12px',
                padding: '1rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                border: `2px solid ${getStatusColor(check.status)}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '1.2rem' }}>{getStatusIcon(check.status)}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', textTransform: 'capitalize' }}>
                    {component}
                  </div>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  {check.responseTime && `応答時間: ${check.responseTime}`}
                  {check.percentage && `使用率: ${check.percentage}`}
                  {check.error && `エラー: ${check.error}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* パフォーマンス統計 */}
      {performanceStats && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1D1D1F' }}>
            ⚡ パフォーマンス統計
          </h2>
          
          {/* グローバル統計 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              borderRadius: '12px',
              padding: '1rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                {performanceStats.global.totalRequests.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>総リクエスト数</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
              borderRadius: '12px',
              padding: '1rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                {performanceStats.global.averageResponseTime.toFixed(1)}ms
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>平均応答時間</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
              borderRadius: '12px',
              padding: '1rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                {performanceStats.global.totalErrors}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>エラー数</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #AF52DE 0%, #FF2D92 100%)',
              borderRadius: '12px',
              padding: '1rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                {performanceStats.healthScore}/100
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>ヘルススコア</div>
            </div>
          </div>

          {/* 最も遅いエンドポイント */}
          {performanceStats.slowestEndpoints.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1rem', color: '#FF9500' }}>
                🐌 最も遅いエンドポイント
              </h3>
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8f9fa' }}>
                    <tr>
                      <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>エンドポイント</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>平均時間</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>リクエスト数</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>エラー率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceStats.slowestEndpoints.slice(0, 5).map((endpoint, index) => (
                      <tr key={endpoint.endpoint} style={{
                        borderBottom: index < 4 ? '1px solid #dee2e6' : 'none'
                      }}>
                        <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          {endpoint.endpoint}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>
                          {endpoint.averageTime.toFixed(1)}ms
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          {endpoint.count.toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <span style={{
                            color: endpoint.errorRate > 5 ? '#FF3B30' : endpoint.errorRate > 1 ? '#FF9500' : '#34C759'
                          }}>
                            {endpoint.errorRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 遅いクエリ */}
          {performanceStats.slowQueries.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1rem', color: '#FF3B30' }}>
                🚨 遅いクエリ（最新10件）
              </h3>
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '12px',
                padding: '1rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {performanceStats.slowQueries.slice(0, 10).map((query, index) => (
                  <div key={query.requestId} style={{
                    padding: '1rem',
                    borderBottom: index < performanceStats.slowQueries.length - 1 ? '1px solid #eee' : 'none',
                    fontSize: '0.9rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                        {query.method} {query.path}
                      </span>
                      <span style={{ color: '#FF3B30', fontWeight: '600' }}>
                        {query.responseTime.toFixed(1)}ms
                      </span>
                    </div>
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>
                      {new Date(query.timestamp).toLocaleString('ja-JP')} | Status: {query.statusCode} | ID: {query.requestId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemMonitoring; 