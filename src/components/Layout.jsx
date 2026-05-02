import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/lessons', label: 'Lessons' },
];

const isActivePath = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleDocumentClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" to={isAuthenticated ? '/home' : '/login'}>
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
                <Link className={`btn add-btn ${isActivePath(pathname, '/lessons/new') ? 'active-btn' : ''}`} to="/lessons/new">
                  <span className="add-btn-short" aria-hidden="true">+</span>
                  <span className="add-btn-label">Add Lesson</span>
                </Link>
                <div className="menu-wrap" ref={menuRef}>
                  <button
                    aria-expanded={isMenuOpen}
                    aria-haspopup="menu"
                    className="btn ghost compact-btn menu-trigger"
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    type="button"
                  >
                    Menu
                  </button>
                  {isMenuOpen ? (
                    <div className="header-menu-dropdown" role="menu">
                      <Link className="header-menu-item" onClick={() => setIsMenuOpen(false)} role="menuitem" to="/lessons/missing-audio">
                        Missing Audio
                      </Link>
                      <Link className="header-menu-item" onClick={() => setIsMenuOpen(false)} role="menuitem" to="/lessons/missing-photo">
                        Missing Photo
                      </Link>
                      <Link className="header-menu-item" onClick={() => setIsMenuOpen(false)} role="menuitem" to="/missing-translation">
                        Missing Translation
                      </Link>
                      <Link className="header-menu-item" onClick={() => setIsMenuOpen(false)} role="menuitem" to="/categories">
                        Categories
                      </Link>
                      <Link className="header-menu-item" onClick={() => setIsMenuOpen(false)} role="menuitem" to="/youtube-study">
                        YouTube Study
                      </Link>
                      <Link className="header-menu-item" onClick={() => setIsMenuOpen(false)} role="menuitem" to="/analytics">
                        Analytics
                      </Link>
                      <button
                        className="header-menu-item"
                        onClick={() => {
                          setIsMenuOpen(false);
                          logout();
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Logout
                      </button>
                    </div>
                  ) : null}
                </div>
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
