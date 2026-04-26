import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <p>読み込み中...</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
