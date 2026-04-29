import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { isAuthenticated, login, loading } = useAuth();
  const [loginError, setLoginError] = useState('');
  const [loginErrorCode, setLoginErrorCode] = useState('');

  if (!loading && isAuthenticated) return <Navigate to="/home" replace />;

  const handleGoogleLogin = async () => {
    setLoginError('');
    setLoginErrorCode('');
    try {
      await login();
    } catch (error) {
      console.error('[AuthDebug] LoginPage handleGoogleLogin failed', {
        code: error?.code,
        message: error?.message,
        name: error?.name,
        customData: error?.customData,
        stack: error?.stack,
      });
      setLoginErrorCode(error?.code || 'unknown-error');
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

      {loginError ? (
        <div className="stack">
          <p className="error">{loginError}</p>
          {loginErrorCode ? <p className="error">Google sign in failed: {loginErrorCode}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
