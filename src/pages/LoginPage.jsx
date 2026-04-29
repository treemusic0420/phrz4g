import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { isAuthenticated, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  if (!loading && isAuthenticated) return <Navigate to="/home" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');
    try {
      await login(email.trim(), password);
    } catch (error) {
      setLoginError(error?.code === 'auth/invalid-credential' ? 'Invalid email or password.' : 'Sign in failed.');
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">Sign in</h2>
      <p className="section-subtle">Sign in with your email and password.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit">Sign in</button>
      </form>

      {loginError ? <p className="error">{loginError}</p> : null}
    </section>
  );
}
