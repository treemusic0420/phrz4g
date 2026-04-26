import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, signIn, blockedMessage, loading } = useAuth();

  if (!loading && user) return <Navigate to="/lessons" replace />;

  return (
    <section className="card">
      <h2>ログイン</h2>
      <p>Googleアカウントでログインしてください。</p>
      <button onClick={signIn} type="button">
        Googleでログイン
      </button>
      {blockedMessage ? <p className="error">{blockedMessage}</p> : null}
    </section>
  );
}
