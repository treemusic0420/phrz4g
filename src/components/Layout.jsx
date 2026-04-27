import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/lessons', label: 'Lessons' },
  { to: '/categories', label: 'Categories' },
  { to: '/stats', label: 'History' },
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
              <nav className="top-nav" aria-label="Main navigation">
                {navItems.map((item) => (
                  <Link key={item.to} className={isActivePath(pathname, item.to) ? 'active' : ''} to={item.to}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="header-actions">
                <Link className="btn add-btn" to="/lessons/new">
                  <span className="add-btn-short" aria-hidden="true">+</span>
                  <span className="add-btn-label">Add Lesson</span>
                </Link>
                <button className="btn ghost compact-btn" onClick={logout} type="button">
                  Logout
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
