import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { formatDateTime, formatSeconds } from '../utils/format';
import {
  DELETED_CATEGORY_LABEL,
  UNSET_CATEGORY_LABEL,
  groupLessonsByRegisteredMonth,
} from '../utils/lessons';

export default function CategoryLessonsPage() {
  const { categoryId } = useParams();
  const [allLessons, setAllLessons] = useState([]);
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

  const monthSummaries = useMemo(() => {
    const categoryLessons = allLessons.filter((lesson) =>
      categoryId === '__unset__' ? !lesson.categoryId : lesson.categoryId === categoryId,
    );
    return groupLessonsByRegisteredMonth(categoryLessons);
  }, [allLessons, categoryId]);

  return (
    <section className="stack">
      <div className="row between">
        <div>
          <p className="section-subtle">Lessons &gt; {categoryName}</p>
          <h2 className="section-title">{categoryName} / Monthly Archive</h2>
          <p className="section-subtle">Months: {monthSummaries.length}</p>
        </div>
        <Link className="btn ghost" to="/lessons">
          Back to Categories
        </Link>
      </div>

      {error ? (
        <p className="card error">
          Failed to load lessons: {error?.code || 'unknown'} / {error?.message || 'Unknown error'}
        </p>
      ) : null}

      {!error && monthSummaries.length === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">No lessons in this category</h3>
          <p className="section-subtle">Go back and select another category.</p>
        </article>
      ) : null}

      {monthSummaries.map((month) => (
        <Link
          className="card lesson-card-link"
          key={month.registeredMonth}
          to={`/lessons/category/${categoryId}/month/${month.registeredMonth}`}
        >
          <div className="row between">
            <h3 className="section-title">{month.registeredMonthLabel}</h3>
            <span className="pill">{month.count} lessons</span>
          </div>
          <p>Total study time: {formatSeconds(month.totalStudySeconds)}</p>
          <p>Last studied: {formatDateTime(month.latestActivityTime)}</p>
          <p className="section-subtle">Open lessons for this month</p>
        </Link>
      ))}
    </section>
  );
}
