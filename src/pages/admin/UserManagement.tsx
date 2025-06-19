import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api/index';
import { logger } from '../../utils/logger';
import { getGradeDisplayName, getGradeColor } from '../../utils/gradeUtils';
import type { AdminUser, UserListResponse } from '../../types/admin';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20
  });

  // フィルター・検索状態
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<'username' | 'createdAt' | 'totalChallenges' | 'averageScore'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadUsers();
  }, [pagination.currentPage, pagination.limit, searchTerm, selectedGrade, sortBy, sortOrder]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminAPI.getUsers({
        page: pagination.currentPage,
        limit: pagination.limit,
        search: searchTerm,
        grade: selectedGrade || undefined,
        sortBy,
        order: sortOrder
      });

      if (response.data.success) {
        const data: UserListResponse = response.data.data;
        setUsers(data.users);
        setPagination(data.pagination);
      }

    } catch (err) {
      logger.error('[UserManagement] ユーザー取得エラー:', err instanceof Error ? err.message : String(err));
      setError('ユーザーデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleGradeFilter = (grade: number | '') => {
    setSelectedGrade(grade);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">👥 ユーザーデータを読み込み中...</div>
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
          👥 ユーザー管理
        </h1>
        <button
          onClick={() => loadUsers()}
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
          🔄 更新
        </button>
      </div>

      {/* 検索・フィルター */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              🔍 検索（ユーザー名・メール）
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ユーザー名またはメールアドレス"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '1rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              🎓 学年フィルター
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => handleGradeFilter(e.target.value === '' ? '' : parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '1rem'
              }}
            >
              <option value="">全ての学年</option>
              {[1, 2, 3, 4, 5, 6].map(grade => (
                <option key={grade} value={grade}>{grade}年生</option>
              ))}
              <option value={7}>その他</option>
              <option value={8}>ひみつ</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              📊 ソート
            </label>
            <select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value as typeof sortBy)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '1rem'
              }}
            >
              <option value="createdAt">登録日</option>
              <option value="username">ユーザー名</option>
              <option value="totalChallenges">チャレンジ数</option>
              <option value="averageScore">平均スコア</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              ⬆️⬇️ 順序
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '1rem'
              }}
            >
              <option value="desc">降順</option>
              <option value="asc">昇順</option>
            </select>
          </div>
        </div>
      </div>

      {/* 統計サマリー */}
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
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>{pagination.totalCount}</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>総ユーザー数</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
          borderRadius: '12px',
          padding: '1rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>
            {users.filter(u => u.totalChallenges > 0).length}
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>アクティブユーザー</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
          borderRadius: '12px',
          padding: '1rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>
            {users.filter(u => u.isAdmin).length}
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>管理者</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #AF52DE 0%, #FF2D92 100%)',
          borderRadius: '12px',
          padding: '1rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>
            {Math.round(users.reduce((sum, u) => sum + u.averageScore, 0) / users.length) || 0}
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>全体平均スコア</div>
        </div>
      </div>

      {/* ユーザー一覧テーブル */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8f9fa' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #dee2e6' }}>
                  ユーザー
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #dee2e6' }}>
                  学年
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #dee2e6' }}>
                  チャレンジ数
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #dee2e6' }}>
                  平均スコア
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #dee2e6' }}>
                  最高スコア
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #dee2e6' }}>
                  登録日
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #dee2e6' }}>
                  最終活動
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user._id} style={{
                  borderBottom: index < users.length - 1 ? '1px solid #dee2e6' : 'none',
                  backgroundColor: user.isAdmin ? 'rgba(255, 149, 0, 0.1)' : 'transparent'
                }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ fontSize: '1.5rem' }}>{user.avatar}</div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1D1D1F' }}>
                          {user.username}
                          {user.isAdmin && (
                            <span style={{
                              marginLeft: '0.5rem',
                              background: '#FF9500',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem'
                            }}>
                              管理者
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      background: getGradeColor(user.grade),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>
                      {getGradeDisplayName(user.grade)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                      {user.totalChallenges.toLocaleString()}回
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem', color: user.averageScore >= 80 ? '#34C759' : user.averageScore >= 60 ? '#FF9500' : '#FF3B30' }}>
                      {user.averageScore}点
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                      {user.bestScore}点
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#666' }}>
                    {formatDate(user.createdAt)}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#666' }}>
                    {formatTime(user.lastActivity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {pagination.totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderTop: '1px solid #dee2e6',
            background: '#f8f9fa'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {((pagination.currentPage - 1) * pagination.limit) + 1} - {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} / {pagination.totalCount}件
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: pagination.currentPage === 1 ? '#f8f9fa' : 'white',
                  color: pagination.currentPage === 1 ? '#999' : '#333',
                  cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                前へ
              </button>
              
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                const page = i + Math.max(1, pagination.currentPage - 2);
                if (page > pagination.totalPages) return null;
                
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: page === pagination.currentPage ? '#007AFF' : 'white',
                      color: page === pagination.currentPage ? 'white' : '#333',
                      cursor: 'pointer'
                    }}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: pagination.currentPage === pagination.totalPages ? '#f8f9fa' : 'white',
                  color: pagination.currentPage === pagination.totalPages ? '#999' : '#333',
                  cursor: pagination.currentPage === pagination.totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement; 