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
      setLoginError(error?.message || 'ログインに失敗しました。');
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">ログイン</h2>
      <p className="section-subtle">パスコードを入力してください。</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label htmlFor="passcode">パスコード</label>
        <input
          id="passcode"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          required
        />

        <button type="submit">ログイン</button>
      </form>

      {loginError ? <p className="error">{loginError}</p> : null}
    </section>
  );
}
