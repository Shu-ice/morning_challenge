import React from 'react';

interface SkeletonLoaderProps {
  variant?: 'text' | 'rectangular' | 'circular' | 'card' | 'list' | 'ranking';
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
  animated?: boolean;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = React.memo(({
  variant = 'text',
  width = '100%',
  height = '1rem',
  lines = 1,
  className = '',
  animated = true
}) => {
  const baseClasses = `
    bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 
    ${animated ? 'animate-pulse' : ''} 
    ${className}
  `;

  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'rounded h-4';
      case 'rectangular':
        return 'rounded-lg';
      case 'circular':
        return 'rounded-full';
      case 'card':
        return 'rounded-xl shadow-sm';
      case 'list':
        return 'rounded-lg';
      case 'ranking':
        return 'rounded-lg';
      default:
        return 'rounded';
    }
  };

  const getStyle = () => ({
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  });

  // テキスト行のスケルトン
  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()}`}
            style={{
              width: index === lines - 1 ? '75%' : '100%', // 最後の行は少し短く
              height: typeof height === 'number' ? `${height}px` : height,
            }}
          />
        ))}
      </div>
    );
  }

  // カード型のスケルトン
  if (variant === 'card') {
    return (
      <div className={`${baseClasses} ${getVariantClasses()} p-6`} style={getStyle()}>
        <div className="space-y-4">
          {/* ヘッダー部分 */}
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
          {/* コンテンツ部分 */}
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-gray-300 rounded w-4/6 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // リスト型のスケルトン
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: lines || 3 }, (_, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-300 rounded-full animate-pulse"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ランキング型のスケルトン
  if (variant === 'ranking') {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines || 5 }, (_, index) => (
          <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
            <div className="w-10 h-10 bg-gray-300 rounded-full animate-pulse"></div>
            <div className="space-y-1 flex-1">
              <div className="h-4 bg-gray-300 rounded w-1/3 animate-pulse"></div>
              <div className="h-3 bg-gray-300 rounded w-1/4 animate-pulse"></div>
            </div>
            <div className="space-y-1">
              <div className="h-4 bg-gray-300 rounded w-16 animate-pulse"></div>
              <div className="h-3 bg-gray-300 rounded w-12 animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 基本的なスケルトン
  return (
    <div
      className={`${baseClasses} ${getVariantClasses()}`}
      style={getStyle()}
    />
  );
});

SkeletonLoader.displayName = 'SkeletonLoader';

// 特殊用途のスケルトンコンポーネント
export const ProblemSkeleton: React.FC = React.memo(() => (
  <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
    <div className="text-center space-y-6">
      {/* 問題番号 */}
      <div className="flex justify-center">
        <div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse"></div>
      </div>
      
      {/* 問題文 */}
      <div className="space-y-4">
        <div className="h-8 bg-gray-300 rounded w-3/4 mx-auto animate-pulse"></div>
        <div className="h-6 bg-gray-300 rounded w-1/2 mx-auto animate-pulse"></div>
      </div>
      
      {/* 問題タイプ */}
      <div className="h-6 bg-gray-300 rounded-full w-24 mx-auto animate-pulse"></div>
    </div>
  </div>
));

ProblemSkeleton.displayName = 'ProblemSkeleton';

export const NavSkeleton: React.FC = React.memo(() => (
  <header className="bg-white shadow-sm">
    <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16 items-center">
        {/* ロゴ */}
        <div className="h-8 bg-gray-300 rounded w-48 animate-pulse"></div>
        
        {/* ナビゲーション */}
        <div className="hidden sm:flex items-center space-x-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-8 bg-gray-300 rounded w-20 animate-pulse"></div>
          ))}
        </div>
        
        {/* モバイルメニューボタン */}
        <div className="sm:hidden">
          <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
        </div>
      </div>
    </nav>
  </header>
));

NavSkeleton.displayName = 'NavSkeleton';

export default SkeletonLoader;