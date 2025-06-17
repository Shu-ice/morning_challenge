import React from 'react';
import { Link } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: '#1D1D1F' }}>
        管理者ダッシュボード
      </h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#007AFF' }}>
            問題生成
          </h3>
          <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            指定した日付と難易度の問題セットを生成します。
          </p>
          <Link 
            to="/admin/generate"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            className="hover:shadow-lg hover:scale-105"
          >
            問題生成ツール
          </Link>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#34C759' }}>
            問題編集
          </h3>
          <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            既存の問題セットを編集・修正します。
          </p>
          <Link 
            to="/admin/edit"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            className="hover:shadow-lg hover:scale-105"
          >
            問題編集ツール
          </Link>
        </div>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#FF9500' }}>
          システム情報
        </h3>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          管理者として、問題の生成と編集を行うことができます。<br />
          問題生成では新しい問題セットを作成し、問題編集では既存の問題を修正できます。
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard; 