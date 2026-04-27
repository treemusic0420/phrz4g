import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/lessons', label: '教材' },
  { to: '/categories', label: 'カテゴリ' },
  { to: '/stats', label: '履歴' },
];

const isActivePath = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" to={isAuthenticated ? '/lessons' : '/login'}>
            Phrz4g
          </Link>
          {isAuthenticated ? (
            <>
              <nav className="top-nav" aria-label="主要ナビゲーション">
                {navItems.map((item) => (
                  <Link key={item.to} className={isActivePath(pathname, item.to) ? 'active' : ''} to={item.to}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="header-actions">
                <Link className="btn add-btn" to="/lessons/new">
                  <span className="add-btn-short" aria-hidden="true">+</span>
                  <span className="add-btn-label">教材追加</span>
                </Link>
                <button className="btn ghost compact-btn" onClick={logout} type="button">
                  ログアウト
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>
      <main className="main-content">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
