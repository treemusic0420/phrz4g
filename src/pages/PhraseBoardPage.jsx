import { useEffect, useMemo, useState } from 'react';
import AudioControls from '../components/AudioControls';
import { useAuth } from '../contexts/AuthContext';
import { ensureInitialCategories, fetchLessons, updateLessonAudioUrl } from '../lib/firestore';
import { getAudioDownloadUrlByPath } from '../lib/storage';
import {
  filterLessonsByCategoryAndMonth,
  getLessonDisplayTitle,
  groupLessonsByCategory,
  groupLessonsByRegisteredMonth,
  hasLessonAudio,
  sortLessonsByCreatedOrder,
} from '../utils/lessons';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

const SLIDE_INTERVAL_MS = 10000;

const getExtFromPath = (path = '') => path.split('.').pop()?.toLowerCase() || '';

const inferTypeByExt = (ext) => {
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  return '';
};

const isUnsupportedAudioFormat = (ext, contentType = '') =>
  ext === 'm4a' || contentType === 'audio/mp4' || contentType === 'audio/x-m4a';

const hasReadableEnglishScript = (lesson = {}) => Boolean(String(lesson.scriptEn || '').trim());

export default function PhraseBoardPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [allLessons, setAllLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState('');
  const [audioLoadStatus, setAudioLoadStatus] = useState('idle');
  const [audioErrorMessage, setAudioErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadBoardData = async () => {
      setLoading(true);
      setError('');
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(userId),
          ensureInitialCategories(userId),
        ]);
        if (cancelled) return;
        setAllLessons(fetchedLessons);
        setCategories(fetchedCategories);
      } catch (fetchError) {
        if (cancelled) return;
        setAllLessons([]);
        setCategories([]);
        setError(`Failed to load Phrase Board: ${fetchError?.code || 'unknown'} / ${fetchError?.message || 'Unknown error'}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (userId) loadBoardData();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const categoryOptions = useMemo(
    () => groupLessonsByCategory(allLessons, categories),
    [allLessons, categories],
  );

  useEffect(() => {
    if (categoryOptions.length === 0) {
      setSelectedCategoryId('');
      return;
    }

    const hasSelectedCategory = categoryOptions.some((category) => category.id === selectedCategoryId);
    if (!hasSelectedCategory) {
      setSelectedCategoryId(categoryOptions[0].id);
    }
  }, [categoryOptions, selectedCategoryId]);

  const categoryLessons = useMemo(
    () => allLessons.filter((lesson) => {
      if (!selectedCategoryId) return false;
      return selectedCategoryId === '__unset__' ? !lesson.categoryId : lesson.categoryId === selectedCategoryId;
    }),
    [allLessons, selectedCategoryId],
  );

  const monthOptions = useMemo(
    () => groupLessonsByRegisteredMonth(categoryLessons),
    [categoryLessons],
  );

  useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth('');
      return;
    }

    const hasSelectedMonth = monthOptions.some((month) => month.registeredMonth === selectedMonth);
    if (!hasSelectedMonth) {
      setSelectedMonth(monthOptions[0].registeredMonth);
    }
  }, [monthOptions, selectedMonth]);

  const boardLessons = useMemo(() => {
    if (!selectedCategoryId || !selectedMonth) return [];
    const filtered = filterLessonsByCategoryAndMonth(allLessons, selectedCategoryId, selectedMonth)
      .filter(hasReadableEnglishScript);
    return sortLessonsByCreatedOrder(filtered);
  }, [allLessons, selectedCategoryId, selectedMonth]);

  useEffect(() => {
    setCurrentIndex(0);
    setResolvedAudioUrl('');
    setAudioLoadStatus('idle');
    setAudioErrorMessage('');
  }, [selectedCategoryId, selectedMonth]);

  useEffect(() => {
    if (boardLessons.length === 0) {
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex((prev) => Math.min(prev, boardLessons.length - 1));
  }, [boardLessons.length]);

  useEffect(() => {
    if (isPaused || boardLessons.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % boardLessons.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [boardLessons.length, isPaused]);

  const currentLesson = boardLessons[currentIndex] || null;
  const selectedCategoryName = categoryOptions.find((category) => category.id === selectedCategoryId)?.name || 'Category';
  const selectedMonthLabel = selectedMonth ? getRegisteredMonthLabel(selectedMonth) : 'Month';
  const fileExtension = getExtFromPath(currentLesson?.audioPath || '');
  const audioContentType = currentLesson?.audioContentType || inferTypeByExt(fileExtension);
  const unsupportedFormat = isUnsupportedAudioFormat(fileExtension, audioContentType);
  const currentLessonHasAudio = hasLessonAudio(currentLesson);

  useEffect(() => {
    if (!currentLesson) {
      setResolvedAudioUrl('');
      return undefined;
    }

    let cancelled = false;

    const resolveUrl = async () => {
      setAudioErrorMessage('');
      setAudioLoadStatus('idle');
      setResolvedAudioUrl('');

      if (!currentLessonHasAudio || unsupportedFormat) return;

      if (currentLesson.audioUrl) {
        setResolvedAudioUrl(currentLesson.audioUrl);
        return;
      }

      if (!currentLesson.audioPath) return;

      setAudioLoadStatus('loading');
      try {
        const url = await getAudioDownloadUrlByPath(currentLesson.audioPath);
        if (cancelled) return;
        setResolvedAudioUrl(url);
        await updateLessonAudioUrl(currentLesson.id, url).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        setAudioLoadStatus('error');
        setAudioErrorMessage(err.message || 'Failed to resolve audio URL from audioPath.');
      }
    };

    resolveUrl();

    return () => {
      cancelled = true;
    };
  }, [currentLesson, currentLessonHasAudio, unsupportedFormat]);

  const goToPrevious = () => {
    if (boardLessons.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + boardLessons.length) % boardLessons.length);
  };

  const goToNext = () => {
    if (boardLessons.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % boardLessons.length);
  };

  return (
    <section className="stack phrase-board-page">
      <div className="phrase-board-header">
        <div>
          <p className="section-subtle">Always-on monthly lesson phrases</p>
          <h2 className="section-title phrase-board-title">Phrase Board</h2>
        </div>
        <p className="phrase-board-interval">Auto advances every 10 seconds</p>
      </div>

      <article className="card phrase-board-filter-card">
        <label>
          Category
          <select
            disabled={loading || categoryOptions.length === 0}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            value={selectedCategoryId}
          >
            {categoryOptions.length === 0 ? <option value="">No categories</option> : null}
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Month
          <select
            disabled={loading || monthOptions.length === 0}
            onChange={(event) => setSelectedMonth(event.target.value)}
            value={selectedMonth}
          >
            {monthOptions.length === 0 ? <option value="">No months</option> : null}
            {monthOptions.map((month) => (
              <option key={month.registeredMonth} value={month.registeredMonth}>
                {month.registeredMonthLabel}
              </option>
            ))}
          </select>
        </label>
      </article>

      {error ? <p className="card error">{error}</p> : null}
      {loading ? <p className="card">Loading Phrase Board...</p> : null}

      {!loading && !error && !currentLesson ? (
        <article className="card empty-state phrase-board-empty">
          <h3 className="section-title">No displayable lessons.</h3>
          <p className="section-subtle">
            Select another Category / Month, or add English Script text to lessons in this month.
          </p>
        </article>
      ) : null}

      {!loading && !error && currentLesson ? (
        <article className="card phrase-board-slide" aria-live="polite">
          <div className="phrase-board-meta-row">
            <span className="pill">{selectedCategoryName}</span>
            <span className="pill">{selectedMonthLabel}</span>
            <span className="pill">{currentIndex + 1} / {boardLessons.length}</span>
          </div>

          <div className="phrase-board-content">
            <p className="section-subtle phrase-board-label">Title</p>
            <h3 className="phrase-board-lesson-title">{getLessonDisplayTitle(currentLesson)}</h3>

            <p className="section-subtle phrase-board-label">English Script</p>
            <p className="phrase-board-script">{currentLesson.scriptEn}</p>

            <p className="section-subtle phrase-board-label">Translation</p>
            <p className="phrase-board-translation">
              {String(currentLesson.scriptJa || '').trim() || 'No translation yet.'}
            </p>
          </div>

          <div className="phrase-board-controls">
            <button className="btn ghost" onClick={goToPrevious} type="button">
              Previous
            </button>
            <button className="btn" onClick={() => setIsPaused((prev) => !prev)} type="button">
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn ghost" onClick={goToNext} type="button">
              Next
            </button>
          </div>

          {currentLessonHasAudio && !unsupportedFormat ? (
            <div className="phrase-board-audio">
              <p className="section-subtle">Audio</p>
              <AudioControls
                lessonId={currentLesson.id}
                audioUrl={resolvedAudioUrl}
                audioContentType={audioContentType}
                onStatusChange={setAudioLoadStatus}
                onErrorMessage={setAudioErrorMessage}
              />
              {audioLoadStatus === 'loading' ? <p className="section-subtle">Loading audio...</p> : null}
              {audioErrorMessage ? <p className="error">{audioErrorMessage}</p> : null}
            </div>
          ) : null}
          {currentLessonHasAudio && unsupportedFormat ? (
            <p className="error">This lesson uses an unsupported audio format. Please re-upload it as MP3.</p>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
