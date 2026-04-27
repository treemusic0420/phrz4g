import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { formatDateTime } from '../utils/format';
import {
  DELETED_CATEGORY_LABEL,
  LESSONS_PER_PAGE,
  UNSET_CATEGORY_LABEL,
  filterLessonsByCategoryAndMonth,
  paginateLessons,
  sortLessonsByRecency,
  sortLessonsForMonthTraining,
} from '../utils/lessons';
import { getDifficultyLabel } from '../utils/difficulty';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

export default function MonthLessonsPage() {
  const { categoryId, registeredMonth } = useParams();
  const [allLessons, setAllLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryId, registeredMonth]);

  useEffect(() => {
    const loadLessons = async () => {
      setError(null);
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(LOCAL_USER_ID),
          ensureInitialCategories(LOCAL_USER_ID),
        ]);
        setAllLessons(fetchedLessons);
        setCategories(fetchedCategories);
      } catch (fetchError) {
        setAllLessons([]);
        setCategories([]);
        setError(fetchError);
      }
    };
    loadLessons();
  }, []);

  const categoryName = useMemo(() => {
    if (categoryId === '__unset__') return UNSET_CATEGORY_LABEL;
    const found = categories.find((category) => category.id === categoryId);
    return found?.name || DELETED_CATEGORY_LABEL;
  }, [categories, categoryId]);

  const monthLabel = useMemo(() => getRegisteredMonthLabel(registeredMonth), [registeredMonth]);

  const monthLessons = useMemo(() => {
    const filtered = filterLessonsByCategoryAndMonth(allLessons, categoryId, registeredMonth);
    return sortLessonsByRecency(filtered);
  }, [allLessons, categoryId, registeredMonth]);

  const monthTrainingLessons = useMemo(
    () => sortLessonsForMonthTraining(monthLessons),
    [monthLessons],
  );

  const firstTrainingLessonId = monthTrainingLessons[0]?.id || '';

  const paging = useMemo(
    () => paginateLessons(monthLessons, currentPage, LESSONS_PER_PAGE),
    [monthLessons, currentPage],
  );

  const shouldShowPaging = paging.total > LESSONS_PER_PAGE;

  return (
    <section className="stack">
      <div className="row between">
        <div>
          <p className="section-subtle">Lessons &gt; {categoryName} &gt; {monthLabel}</p>
          <h2 className="section-title">{categoryName} / {monthLabel}</h2>
          <p className="section-subtle">Lessons: {paging.total}</p>
        </div>
        <div className="row gap-sm wrap month-action-buttons">
          <Link
            className="btn"
            to={
              firstTrainingLessonId
                ? `/lessons/${firstTrainingLessonId}/dictation?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}`
                : '#'
            }
            aria-disabled={!firstTrainingLessonId}
            onClick={(event) => {
              if (!firstTrainingLessonId) event.preventDefault();
            }}
          >
            Start Dictation
          </Link>
          <Link
            className="btn"
            to={
              firstTrainingLessonId
                ? `/lessons/${firstTrainingLessonId}/shadowing?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}`
                : '#'
            }
            aria-disabled={!firstTrainingLessonId}
            onClick={(event) => {
              if (!firstTrainingLessonId) event.preventDefault();
            }}
          >
            Start Shadowing
          </Link>
          <Link className="btn ghost" to={`/lessons/category/${categoryId}`}>
            Back to Monthly Archive
          </Link>
        </div>
      </div>

      {error ? (
        <p className="card error">
          Failed to load lessons: {error?.code || 'unknown'} / {error?.message || 'Unknown error'}
        </p>
      ) : null}

      {!error && paging.total === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">No lessons in this month.</h3>
          <p className="section-subtle">Go back and select another month.</p>
        </article>
      ) : null}

      {paging.items.map((lesson) => (
        <Link className="card compact-lesson-link" key={lesson.id} to={`/lessons/${lesson.id}`}>
          <div className="row between gap-sm compact-lesson-head">
            <h3 className="compact-lesson-title">{lesson.title}</h3>
            <span className="pill">Difficulty: {getDifficultyLabel(lesson.difficulty)}</span>
          </div>
          <p className="section-subtle">Last studied: {formatDateTime(lesson.lastStudiedAt)}</p>
        </Link>
      ))}

      {shouldShowPaging ? (
        <div className="card pagination-box">
          <div className="row gap-sm wrap center">
            <button
              className="btn ghost"
              disabled={paging.page <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              type="button"
            >
              Previous
            </button>
            <p>
              {paging.page} / {paging.totalPages}
            </p>
            <button
              className="btn ghost"
              disabled={paging.page >= paging.totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(paging.totalPages, prev + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
