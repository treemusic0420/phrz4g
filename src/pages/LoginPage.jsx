import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { isAuthenticated, loginWithPasscode, loading } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');

  if (!loading && isAuthenticated) return <Navigate to="/lessons" replace />;

  const handleSubmit = (event) => {
    event.preventDefault();
    setLoginError('');

    try {
      loginWithPasscode(passcode);
    } catch (error) {
      setLoginError(error?.message || 'Login failed.');
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">Login</h2>
      <p className="section-subtle">Enter your passcode.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label htmlFor="passcode">Passcode</label>
        <input
          id="passcode"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          required
        />

        <button type="submit">Login</button>
      </form>

      {loginError ? <p className="error">{loginError}</p> : null}
    </section>
  );
}
