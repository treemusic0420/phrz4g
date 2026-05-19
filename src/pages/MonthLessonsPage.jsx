import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { formatDateTime } from '../utils/format';
import {
  DELETED_CATEGORY_LABEL,
  LESSONS_PER_PAGE,
  UNSET_CATEGORY_LABEL,
  filterLessonsByCategoryAndMonth,
  hasLessonAudio,
  paginateLessons,
  sortLessonsByRecency,
  sortLessonsForMonthTraining,
  hasInstantRecallContent,
  sortLessonsByCreatedOrder,
  chunkLessons,
} from '../utils/lessons';
import { getDifficultyLabel, getDifficultyStyle } from '../utils/difficulty';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

export default function MonthLessonsPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
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
          fetchLessons(userId),
          ensureInitialCategories(userId),
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
    () => sortLessonsForMonthTraining(monthLessons.filter((lesson) => hasLessonAudio(lesson))),
    [monthLessons],
  );

  const monthLessonsInCreatedOrder = useMemo(() => sortLessonsByCreatedOrder(monthLessons), [monthLessons]);
  const practiceSets = useMemo(() => {
    const chunks = chunkLessons(monthLessonsInCreatedOrder, 10);
    return chunks.map((lessons, index) => {
      const audioLessons = lessons.filter((lesson) => hasLessonAudio(lesson));
      const instantRecallReadyLessons = lessons.filter((lesson) => hasInstantRecallContent(lesson));
      const latestLastStudiedAt = lessons.reduce((latest, lesson) => {
        const value = lesson?.lastStudiedAt;
        const time = value?.toDate ? value.toDate().getTime() : value ? new Date(value).getTime() : 0;
        if (!Number.isFinite(time)) return latest;
        return Math.max(latest, time);
      }, 0);
      return {
        id: `set-${index + 1}`,
        index: index + 1,
        lessons,
        lessonIdsParam: lessons.map((lesson) => lesson.id).join(','),
        audioFirstId: audioLessons[0]?.id || '',
        instantRecallFirstId: instantRecallReadyLessons[0]?.id || '',
        audioCount: audioLessons.length,
        instantRecallCount: instantRecallReadyLessons.length,
        latestLastStudiedAt: latestLastStudiedAt ? new Date(latestLastStudiedAt) : null,
      };
    });
  }, [monthLessonsInCreatedOrder]);

  const firstTrainingLessonId = monthTrainingLessons[0]?.id || '';
  const instantRecallLessons = useMemo(
    () => sortLessonsForMonthTraining(monthLessons.filter((lesson) => hasInstantRecallContent(lesson))),
    [monthLessons],
  );
  const firstInstantRecallLessonId = instantRecallLessons[0]?.id || '';
  const audioLessonCount = monthTrainingLessons.length;

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
          <p className="section-subtle">{audioLessonCount} audio lessons / {paging.total} total lessons</p>
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
            Start All Dictation
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
            Start All Shadowing
          </Link>
          <Link
            className="btn"
            to={
              firstInstantRecallLessonId
                ? `/lessons/${firstInstantRecallLessonId}/instant-recall?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}`
                : '#'
            }
            aria-disabled={!firstInstantRecallLessonId}
            onClick={(event) => {
              if (!firstInstantRecallLessonId) event.preventDefault();
            }}
          >
            Start All Instant Recall
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
      {!error && paging.total > 0 && audioLessonCount === 0 ? (
        <article className="card">
          <p className="section-subtle">No audio lessons available in this month.</p>
        </article>
      ) : null}

      {practiceSets.length > 0 ? (
        <div className="stack">
          {practiceSets.map((set) => (
            <article className="card" key={set.id}>
              <div className="row between wrap gap-sm">
                <div>
                  <h3 className="section-title">Practice Set {set.index}</h3>
                  <p className="section-subtle">{set.lessons.length} lessons</p>
                  <p className="section-subtle">Latest last studied: {set.latestLastStudiedAt ? formatDateTime(set.latestLastStudiedAt) : '—'}</p>
                </div>
                <div className="row gap-sm wrap month-action-buttons">
                  <Link className="btn" to={set.audioFirstId ? `/lessons/${set.audioFirstId}/dictation?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}&lessonIds=${encodeURIComponent(set.lessonIdsParam)}` : '#'} aria-disabled={!set.audioFirstId} onClick={(event) => { if (!set.audioFirstId) event.preventDefault(); }}>Dictation</Link>
                  <Link className="btn" to={set.audioFirstId ? `/lessons/${set.audioFirstId}/shadowing?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}&lessonIds=${encodeURIComponent(set.lessonIdsParam)}` : '#'} aria-disabled={!set.audioFirstId} onClick={(event) => { if (!set.audioFirstId) event.preventDefault(); }}>Shadowing</Link>
                  <Link className="btn" to={set.instantRecallFirstId ? `/lessons/${set.instantRecallFirstId}/instant-recall?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}&lessonIds=${encodeURIComponent(set.lessonIdsParam)}` : '#'} aria-disabled={!set.instantRecallFirstId} onClick={(event) => { if (!set.instantRecallFirstId) event.preventDefault(); }}>Instant Recall</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {paging.items.map((lesson) => {
        const difficultyStyle = getDifficultyStyle(lesson.difficulty);
        const isAudioReady = hasLessonAudio(lesson);
        return (
          <Link
            className={`card compact-lesson-link difficulty-card ${difficultyStyle.tone}`}
            key={lesson.id}
            to={`/lessons/${lesson.id}`}
          >
            <div className="row between gap-sm compact-lesson-head">
              <h3 className="compact-lesson-title">{lesson.title}</h3>
              <span className={`pill difficulty-pill ${difficultyStyle.tone}`}>
                Difficulty: {getDifficultyLabel(lesson.difficulty)}
              </span>
            </div>
            {lesson.imageUrl ? (
              <img className="lesson-list-thumbnail" src={lesson.imageUrl} alt={`${lesson.title} thumbnail`} />
            ) : null}
            {!isAudioReady ? <span className="pill no-audio-badge">No audio</span> : null}
            <p className="section-subtle">Last studied: {formatDateTime(lesson.lastStudiedAt)}</p>
          </Link>
        );
      })}

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
