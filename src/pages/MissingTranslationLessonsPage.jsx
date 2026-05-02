import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ensureInitialCategories, fetchLessons, updateLessonTranslation } from '../lib/firestore';
import { formatDateTime, toDate } from '../utils/format';
import { getDifficultyLabel } from '../utils/difficulty';
import { resolveRegisteredMonthFields } from '../utils/registeredMonth';
import MissingLessonsFilters from '../components/MissingLessonsFilters';

const isBlank = (value) => String(value || '').trim().length === 0;

const getSortTime = (lesson) => {
  const createdAt = toDate(lesson?.createdAt);
  if (createdAt && !Number.isNaN(createdAt.getTime())) return createdAt.getTime();
  const updatedAt = toDate(lesson?.updatedAt);
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) return updatedAt.getTime();
  return 0;
};

export default function MissingTranslationLessonsPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingIds, setSavingIds] = useState({});
  const [lessonErrors, setLessonErrors] = useState({});
  const [savedIds, setSavedIds] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  useEffect(() => {
    const loadLessons = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(userId),
          ensureInitialCategories(userId),
        ]);
        setLessons(fetchedLessons);
        setCategories(fetchedCategories);
      } catch {
        setLessons([]);
        setCategories([]);
        setError('Failed to load lessons.');
      } finally {
        setIsLoading(false);
      }
    };

    loadLessons();
  }, [userId]);

  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const missingTranslationLessons = useMemo(
    () => lessons
      .filter((lesson) => !savedIds[lesson.id])
      .filter((lesson) => !isBlank(lesson.scriptEn))
      .filter((lesson) => isBlank(lesson.scriptJa))
      .sort((a, b) => {
        const monthDiff = String(b.registeredMonth || '').localeCompare(String(a.registeredMonth || ''));
        if (monthDiff !== 0) return monthDiff;
        return getSortTime(b) - getSortTime(a);
      }),
    [lessons, savedIds],
  );

  const availableMonths = useMemo(() => {
    const monthMap = new Map();
    missingTranslationLessons.forEach((lesson) => {
      const monthFields = resolveRegisteredMonthFields(lesson);
      const monthKey = monthFields.registeredMonth || '';
      if (monthKey) monthMap.set(monthKey, monthFields.registeredMonthLabel || monthKey);
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .map(([value, label]) => ({ value, label }));
  }, [missingTranslationLessons]);

  const filteredLessons = useMemo(() => missingTranslationLessons.filter((lesson) => {
    if (categoryFilter !== 'all' && (lesson.categoryId || '__unset__') !== categoryFilter) return false;
    if (difficultyFilter !== 'all' && (lesson.difficulty || 'easy') !== difficultyFilter) return false;
    if (monthFilter !== 'all') {
      const monthFields = resolveRegisteredMonthFields(lesson);
      if ((monthFields.registeredMonth || '') !== monthFilter) return false;
    }
    return true;
  }), [missingTranslationLessons, categoryFilter, difficultyFilter, monthFilter]);

  const onSave = async (lesson) => {
    const nextTranslation = String(drafts[lesson.id] || '').trim();
    if (!nextTranslation) {
      setLessonErrors((prev) => ({ ...prev, [lesson.id]: 'Please enter a translation before saving.' }));
      return;
    }

    setSavingIds((prev) => ({ ...prev, [lesson.id]: true }));
    setLessonErrors((prev) => ({ ...prev, [lesson.id]: '' }));

    try {
      await updateLessonTranslation(lesson.id, nextTranslation);
      setSavedIds((prev) => ({ ...prev, [lesson.id]: true }));
      setDrafts((prev) => ({ ...prev, [lesson.id]: '' }));
      window.setTimeout(() => {
        setLessons((prev) => prev.filter((item) => item.id !== lesson.id));
      }, 500);
    } catch {
      setLessonErrors((prev) => ({ ...prev, [lesson.id]: 'Failed to save translation.' }));
    } finally {
      setSavingIds((prev) => ({ ...prev, [lesson.id]: false }));
    }
  };

  return (
    <section className="stack">
      <div className="row between">
        <div>
          <p className="section-subtle">Lesson Management</p>
          <h2 className="section-title">Missing Translation</h2>
          {!isLoading ? <p className="section-subtle">Missing translation: {filteredLessons.length} lessons</p> : null}
        </div>
        <div className="row gap-sm wrap">
          <Link className="btn ghost" to="/lessons/missing-audio">Missing Audio</Link>
          <Link className="btn ghost" to="/lessons">Back to Lessons</Link>
        </div>
      </div>

      {error ? <article className="card error">{error}</article> : null}

      {!isLoading && !error ? (
        <MissingLessonsFilters
          availableMonths={availableMonths}
          categories={categories}
          categoryFilter={categoryFilter}
          difficultyFilter={difficultyFilter}
          monthFilter={monthFilter}
          onCategoryChange={setCategoryFilter}
          onDifficultyChange={setDifficultyFilter}
          onMonthChange={setMonthFilter}
        />
      ) : null}

      {isLoading ? <article className="card section-subtle">Loading lessons...</article> : null}

      {!isLoading && !error && filteredLessons.length === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">All lessons have translations.</h3>
          <div className="row gap-sm wrap center">
            <Link className="btn ghost" to="/lessons">Lessons</Link>
            <Link className="btn" to="/lessons/new">Add Lesson</Link>
          </div>
        </article>
      ) : null}

      {!isLoading && !error
        ? filteredLessons.map((lesson) => {
            const monthFields = resolveRegisteredMonthFields(lesson);
            const categoryName = categoryNameById.get(lesson.categoryId) || 'Not set';
            const isSaving = !!savingIds[lesson.id];
            const cardError = lessonErrors[lesson.id] || '';
            const updatedAtLabel = lesson.updatedAt ? formatDateTime(lesson.updatedAt) : formatDateTime(lesson.createdAt);
            return (
              <article className="card missing-photo-card" key={lesson.id}>
                <div className="row between missing-audio-card-head">
                  <h3 className="section-title">{lesson.title || 'Untitled lesson'}</h3>
                  <span className="pill">{getDifficultyLabel(lesson.difficulty)}</span>
                </div>
                <p className="section-subtle">Category: {categoryName}</p>
                <p className="section-subtle">Month: {monthFields.registeredMonthLabel || monthFields.registeredMonth || '-'}</p>
                <p className="missing-audio-script">{String(lesson.scriptEn || '').trim()}</p>
                {lesson.memo ? <p className="section-subtle">Note: {lesson.memo}</p> : null}
                <p className="section-subtle">Updated: {updatedAtLabel}</p>

                <div className="stack">
                  <label className="section-subtle" htmlFor={`translation-${lesson.id}`}>Translation</label>
                  <textarea
                    id={`translation-${lesson.id}`}
                    rows={4}
                    value={drafts[lesson.id] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((prev) => ({ ...prev, [lesson.id]: value }));
                      if (lessonErrors[lesson.id]) {
                        setLessonErrors((prev) => ({ ...prev, [lesson.id]: '' }));
                      }
                    }}
                    placeholder="Add Japanese translation"
                    disabled={isSaving}
                  />
                  <div className="row gap-sm wrap">
                    <button type="button" disabled={isSaving} onClick={() => onSave(lesson)}>
                      {isSaving ? 'Saving...' : 'Save Translation'}
                    </button>
                    <Link className="btn ghost" to={`/lessons/${lesson.id}/edit`}>Edit</Link>
                  </div>
                  {cardError ? <p className="error">{cardError}</p> : null}
                </div>
              </article>
            );
          })
        : null}
    </section>
  );
}
