import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, signIn, blockedMessage, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);

  if (!loading && user) return <Navigate to="/lessons" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoginError(null);

    try {
      await signIn(email, password);
    } catch (error) {
      setLoginError({
        code: error?.code || 'auth/unknown',
        message: error?.message || 'ログインに失敗しました。',
      });
    }
  };

  return (
    <section className="card">
      <h2>ログイン</h2>
      <p>Email / Password でログインしてください。</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit">ログイン</button>
      </form>

      {blockedMessage ? <p className="error">{blockedMessage}</p> : null}
      {loginError ? <p className="error">{`error.code: ${loginError.code} / error.message: ${loginError.message}`}</p> : null}
    </section>
  );
}
