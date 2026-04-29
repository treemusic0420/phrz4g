import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, authDelayWarning } = useAuth();

  if (loading) {
    return (
      <div>
        <p>Loading...</p>
        {authDelayWarning ? <p>Authentication is taking longer than expected.</p> : null}
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
