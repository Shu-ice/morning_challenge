import React, { ReactNode } from 'react';
import { TopNav } from '../components/TopNav';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #F5F5F7 0%, #FAFAFA 50%, #F5F5F7 100%)' }}>
      <TopNav />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p style={{
            textAlign: 'center',
            color: '#86868B',
            fontSize: '0.875rem',
            fontWeight: '400',
            margin: 0
          }}>
            © 2025 
            <ruby>
              朝<rt>あさ</rt>
            </ruby>
            の
            <ruby>
              計算<rt>けいさん</rt>
            </ruby>
            チャレンジ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}; 