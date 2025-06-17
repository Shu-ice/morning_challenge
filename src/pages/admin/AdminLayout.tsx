import React from 'react';
import { Navigate, Outlet, Link } from 'react-router-dom';
// import { useAuth } from '@/contexts/AuthContext'; // localStorage を使用
import '@/styles/AdminLayout.css'; // CSSファイルも後で作成
import { logger } from '@/utils/logger';

const AdminLayout: React.FC = () => {
  // localStorage から管理者フラグを確認
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      try {
        const userData = JSON.parse(storedUserInfo);
        // userInfo に isAdmin が含まれているか確認
        setIsAdmin(userData?.isAdmin === true); 
      } catch (e) {
        logger.error("Failed to parse user info from localStorage", e instanceof Error ? e : String(e));
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false); // ユーザー情報がなければ非管理者
    }
    setLoading(false);
  }, []);


  if (loading) {
    return <div>管理者権限を確認中...</div>; // ローディング表示
  }

  if (!isAdmin) {
    // 管理者でなければホームページなどにリダイレクト
    logger.warn("AdminLayout: User is not an admin. Redirecting to login...");
    // ログインページにリダイレクトするのが適切かもしれません
    return <Navigate to="/login" replace />;
  }

  // 管理者であれば、共通レイアウトと子ルートを表示
  return (
    <div className="admin-layout">
      <header className="admin-header">
        <h1>管理者ページ</h1>
        <nav className="admin-nav">
          <Link to="/admin/dashboard">ダッシュボード</Link>
          <Link to="/admin/generate">問題生成</Link>
          <Link to="/admin/edit">問題閲覧・編集</Link>
          <Link to="/">通常ページへ</Link> {/* 通常ページへ戻るリンク */}
        </nav>
      </header>
      <main className="admin-content">
        <Outlet /> {/* ここに各管理者ページの内容が表示される */}
      </main>
      <footer className="admin-footer">
        <p>&copy; 2025 Morning Math Challenge Admin</p>
      </footer>
    </div>
  );
};

export default AdminLayout; 