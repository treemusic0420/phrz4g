import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LessonsPage from './pages/LessonsPage';
import CategoryLessonsPage from './pages/CategoryLessonsPage';
import LessonFormPage from './pages/LessonFormPage';
import LessonDetailPage from './pages/LessonDetailPage';
import DictationPage from './pages/DictationPage';
import ShadowingPage from './pages/ShadowingPage';
import StatsPage from './pages/StatsPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/lessons"
          element={
            <ProtectedRoute>
              <LessonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/new"
          element={
            <ProtectedRoute>
              <LessonFormPage mode="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/category/:categoryKey"
          element={
            <ProtectedRoute>
              <CategoryLessonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/:id"
          element={
            <ProtectedRoute>
              <LessonDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/:id/edit"
          element={
            <ProtectedRoute>
              <LessonFormPage mode="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/:id/dictation"
          element={
            <ProtectedRoute>
              <DictationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/:id/shadowing"
          element={
            <ProtectedRoute>
              <ShadowingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stats"
          element={
            <ProtectedRoute>
              <StatsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/lessons" replace />} />
      </Routes>
    </Layout>
  );
}
