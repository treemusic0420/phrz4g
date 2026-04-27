import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/lessons', label: '教材' },
  { to: '/stats', label: '履歴' },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="container">
        <header className="header">
          <div>
            <h1 className="app-title">Phrz4g</h1>
            <p className="muted">自分専用ディクテーション / シャドーイング</p>
          </div>
          {isAuthenticated ? (
            <div className="header-right">
              <button className="btn ghost" onClick={logout} type="button">
                ログアウト
              </button>
            </div>
          ) : null}
        </header>
        <main className="main-content">{children}</main>
      </div>
      {isAuthenticated ? (
        <nav className="bottom-nav">
          {navItems.map((item) => (
            <Link key={item.to} className={pathname.startsWith(item.to) ? 'active' : ''} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <div className="safe-bottom-space" />
    </div>
  );
}
