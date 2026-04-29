import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { formatDateTime, formatSeconds } from '../utils/format';
import { getDifficultyLabel } from '../utils/difficulty';
import { resolveRegisteredMonthFields } from '../utils/registeredMonth';
import { groupLessonsByCategory, hasLessonAudio, sortLessonsByRecency } from '../utils/lessons';

export default function LessonsPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const loadLessons = async () => {
      setError(null);
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(userId),
          ensureInitialCategories(userId),
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
  const normalizedQuery = searchText.trim().toLowerCase();
  const categoryNameById = useMemo(
    () =>
      new Map(
        categories.map((category) => [category.id, category.name]),
      ),
    [categories],
  );
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return sortLessonsByRecency(lessons).filter((lesson) =>
      [lesson.title, lesson.scriptEn, lesson.scriptJa, lesson.memo]
        .map((value) => String(value || '').toLowerCase())
        .some((fieldValue) => fieldValue.includes(normalizedQuery)),
    );
  }, [lessons, normalizedQuery]);

  return (
    <section className="stack">
      <h2 className="section-title">Categories</h2>
      <article className="card lesson-search-card">
        <div className="lesson-search-row">
          <input
            aria-label="Search lessons"
            placeholder="Search lessons..."
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <button className="btn ghost" type="button" onClick={() => setSearchText('')} disabled={!searchText.trim()}>
            Clear
          </button>
        </div>
      </article>
      <details className="debug-panel">
        <summary>Debug Info</summary>
        <p>debug.userId: {userId}</p>
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
      {!normalizedQuery
        ? categorySummaries.map((category) => (
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
          ))
        : null}
      {normalizedQuery ? (
        <article className="card">
          <h3>Search Results</h3>
          {searchResults.length === 0 ? (
            <p className="section-subtle">No lessons found.</p>
          ) : (
            <ul className="dashboard-list lesson-search-results">
              {searchResults.map((lesson) => {
                const monthFields = resolveRegisteredMonthFields(lesson);
                const categoryName = lesson.categoryId
                  ? categoryNameById.get(lesson.categoryId) || 'Deleted category'
                  : '-';
                const snippet = String(lesson.scriptEn || '').trim();
                return (
                  <li className="dashboard-list-item lesson-search-item" key={lesson.id}>
                    <p className="dashboard-list-title">{lesson.title || 'Untitled lesson'}</p>
                    <p className="section-subtle">Category: {categoryName}</p>
                    <p className="section-subtle">
                      Month: {monthFields.registeredMonthLabel || monthFields.registeredMonth || '-'} · Difficulty:{' '}
                      {getDifficultyLabel(lesson.difficulty)} · Audio: {hasLessonAudio(lesson) ? 'Audio' : 'No audio'}
                    </p>
                    {snippet ? <p className="section-subtle">EN: {snippet.slice(0, 120)}{snippet.length > 120 ? '...' : ''}</p> : null}
                    <div className="row gap-sm wrap">
                      <Link className="btn ghost" to={`/lessons/${lesson.id}`}>Details</Link>
                      <Link className="btn ghost" to={`/lessons/${lesson.id}/edit`}>Edit</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      ) : null}
    </section>
  );
}
