import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LessonsPage from './pages/LessonsPage';
import CategoryLessonsPage from './pages/CategoryLessonsPage';
import MonthLessonsPage from './pages/MonthLessonsPage';
import LessonFormPage from './pages/LessonFormPage';
import LessonDetailPage from './pages/LessonDetailPage';
import DictationPage from './pages/DictationPage';
import ShadowingPage from './pages/ShadowingPage';
import StatsPage from './pages/StatsPage';
import CategoriesPage from './pages/CategoriesPage';
import CategoryFormPage from './pages/CategoryFormPage';
import MissingAudioLessonsPage from './pages/MissingAudioLessonsPage';
import MissingPhotoLessonsPage from './pages/MissingPhotoLessonsPage';
import QuickAddLessonPage from './pages/QuickAddLessonPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <StatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons"
          element={
            <ProtectedRoute>
              <LessonsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/lessons/missing-audio"
          element={
            <ProtectedRoute>
              <MissingAudioLessonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/missing-photo"
          element={
            <ProtectedRoute>
              <MissingPhotoLessonsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/lessons/quick-add"
          element={
            <ProtectedRoute>
              <QuickAddLessonPage />
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
          path="/lessons/category/:categoryId"
          element={
            <ProtectedRoute>
              <CategoryLessonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/category/:categoryId/month/:registeredMonth"
          element={
            <ProtectedRoute>
              <MonthLessonsPage />
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
          path="/categories"
          element={
            <ProtectedRoute>
              <CategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories/new"
          element={
            <ProtectedRoute>
              <CategoryFormPage mode="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories/:id/edit"
          element={
            <ProtectedRoute>
              <CategoryFormPage mode="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/stats" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Layout>
  );
}
