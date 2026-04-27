import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { formatDateTime, formatSeconds } from '../utils/format';
import { groupLessonsByCategory } from '../utils/lessons';

export default function LessonsPage() {
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadLessons = async () => {
      setError(null);
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(LOCAL_USER_ID),
          ensureInitialCategories(LOCAL_USER_ID),
        ]);
        setLessons(fetchedLessons);
        setCategories(fetchedCategories);
      } catch (fetchError) {
        setLessons([]);
        setCategories([]);
        setError(fetchError);
      }
    };
    loadLessons();
  }, []);
  const categorySummaries = groupLessonsByCategory(lessons, categories);

  return (
    <section className="stack">
      <h2 className="section-title">Categories</h2>
      <details className="debug-panel">
        <summary>Debug Info</summary>
        <p>debug.userId: {LOCAL_USER_ID}</p>
        <p>debug.lessonCount: {lessons.length}</p>
        <p>debug.categoryCount: {categories.length}</p>
        {error ? (
          <p className="error">
            debug.error: {error?.code || 'unknown'} / {error?.message || 'Unknown error'}
          </p>
        ) : null}
      </details>
      {error ? (
        <p className="card error">
          Failed to load lessons: {error?.code || 'unknown'} / {error?.message || 'Unknown error'}
        </p>
      ) : null}
      {!error && lessons.length === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">No lessons yet</h3>
          <p className="section-subtle">No lessons yet. Add your first lesson.</p>
          <div className="row gap-sm wrap center">
            <Link className="btn" to="/lessons/new">
              Add Lesson
            </Link>
          </div>
        </article>
      ) : null}
      {categorySummaries.map((category) => (
        <Link className="card category-card" key={category.id} to={`/lessons/category/${category.id}`}>
          <div className="row between category-card-header">
            <h3 className="section-title">{category.name}</h3>
            <span className="pill">{category.count} lessons</span>
          </div>
          <p className="category-card-meta">Months: {category.monthCount}</p>
          <p className="category-card-meta">
            Last studied: {formatDateTime(category.latestActivityTime)} / Total study time:{' '}
            {formatSeconds(category.totalStudySeconds)}
          </p>
        </Link>
      ))}
    </section>
  );
}
