import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { formatDateTime, formatSeconds } from '../utils/format';
import {
  DELETED_CATEGORY_LABEL,
  LESSONS_PER_PAGE,
  UNSET_CATEGORY_LABEL,
  filterLessonsByCategoryAndMonth,
  paginateLessons,
  sortLessonsByRecency,
} from '../utils/lessons';
import { getDifficultyLabel } from '../utils/difficulty';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

const createSnippet = (text = '', maxLength = 120) => {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (!oneLine) return '-';
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength)}…`;
};

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
        <Link className="btn ghost" to={`/lessons/category/${categoryId}`}>
          Back to Monthly Archive
        </Link>
      </div>

      {error ? (
        <p className="card error">
          Failed to load lessons: {error?.code || 'unknown'} / {error?.message || 'Unknown error'}
        </p>
      ) : null}

      {!error && paging.total === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">No lessons in this month</h3>
          <p className="section-subtle">Go back and select another month.</p>
        </article>
      ) : null}

      {paging.items.map((lesson) => (
        <Link className="card lesson-card-link" key={lesson.id} to={`/lessons/${lesson.id}`}>
          <h3 className="section-title">{lesson.title}</h3>
          <p>Difficulty: {getDifficultyLabel(lesson.difficulty)}</p>
          <p>English Script: {createSnippet(lesson.scriptEn)}</p>
          <p>Dictation attempts: {lesson.dictationCount || 0}</p>
          <p>Shadowing attempts: {lesson.shadowingCount || 0}</p>
          <p>Total study time: {formatSeconds(lesson.totalStudySeconds || 0)}</p>
          <p>Last studied: {formatDateTime(lesson.lastStudiedAt)}</p>
          <p className="section-subtle">Open lesson details</p>
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
