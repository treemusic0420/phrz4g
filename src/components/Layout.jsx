import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/lessons', label: '教材' },
  { to: '/stats', label: '履歴' },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Phrz4g</h1>
          <p className="muted">自分専用ディクテーション / シャドーイング</p>
        </div>
        {user ? (
          <div className="header-right">
            <small>{user.email}</small>
            <button onClick={logout}>ログアウト</button>
          </div>
        ) : null}
      </header>
      <main>{children}</main>
      {user ? (
        <nav className="bottom-nav">
          {navItems.map((item) => (
            <Link key={item.to} className={pathname.startsWith(item.to) ? 'active' : ''} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
