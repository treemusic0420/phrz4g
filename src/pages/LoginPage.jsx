import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { isAuthenticated, login, loading } = useAuth();
  const [loginError, setLoginError] = useState('');

  if (!loading && isAuthenticated) return <Navigate to="/home" replace />;

  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      await login();
    } catch (error) {
      console.error('Google sign in failed:', error?.code, error);
      setLoginError('Google sign in failed. Please try again.');
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">Sign in</h2>
      <p className="section-subtle">Sign in with your Google account.</p>

      <div className="stack">
        <button type="button" onClick={handleGoogleLogin}>
          Sign in with Google
        </button>
      </div>

      {loginError ? <p className="error">{loginError}</p> : null}
    </section>
  );
}
