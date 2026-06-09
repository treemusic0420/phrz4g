import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchLessons, updateLessonAudioUrl } from '../lib/firestore';
import { getAudioDownloadUrlByPath } from '../lib/storage';
import {
  getLessonDisplayTitle,
  hasLessonAudio,
  sortLessonsByCreatedOrder,
} from '../utils/lessons';

const PHRASE_INTERVAL_MS = 5000;
const AUDIO_LOAD_TIMEOUT_MS = 7000;

const hasReadableEnglishScript = (lesson = {}) => Boolean(String(lesson.scriptEn || '').trim());

const withTimeout = (promise, timeoutMs, timeoutMessage) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
};

export default function PhraseBoardPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const audioRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const [allLessons, setAllLessons] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [audioStatus, setAudioStatus] = useState('idle');
  const [audioMessage, setAudioMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadBoardData = async () => {
      setLoading(true);
      setError('');
      try {
        const fetchedLessons = await fetchLessons(userId);
        if (cancelled) return;
        setAllLessons(fetchedLessons);
      } catch (fetchError) {
        if (cancelled) return;
        setAllLessons([]);
        setError(`Failed to load Phrase Board: ${fetchError?.code || 'unknown'} / ${fetchError?.message || 'Unknown error'}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (userId) {
      loadBoardData();
    } else {
      setAllLessons([]);
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const boardLessons = useMemo(
    () => sortLessonsByCreatedOrder(allLessons.filter(hasReadableEnglishScript)),
    [allLessons],
  );

  useEffect(() => {
    if (boardLessons.length === 0) {
      setCurrentIndex(0);
      setHasStarted(false);
      return;
    }

    setCurrentIndex((prev) => Math.min(prev, boardLessons.length - 1));
  }, [boardLessons.length]);

  const currentLesson = boardLessons[currentIndex] || null;
  const currentLessonHasAudio = hasLessonAudio(currentLesson);

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const stopAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };

  const advanceToNextLesson = () => {
    if (boardLessons.length === 0) return;
    if (boardLessons.length === 1) {
      setPlaybackKey((prev) => prev + 1);
      return;
    }
    setCurrentIndex((prev) => (prev + 1) % boardLessons.length);
  };

  const scheduleNextLesson = () => {
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      advanceToNextLesson();
    }, PHRASE_INTERVAL_MS);
  };

  useEffect(() => () => {
    clearAdvanceTimer();
    stopAudio();
  }, []);

  useEffect(() => {
    clearAdvanceTimer();
    stopAudio();
    setAudioStatus(currentLessonHasAudio ? 'idle' : 'none');
    setAudioMessage('');

    if (!hasStarted || isPaused || !currentLesson) return undefined;

    let cancelled = false;
    const audio = audioRef.current;

    const finishWithoutAudio = (message = '') => {
      if (cancelled) return;
      setAudioStatus(message ? 'unavailable' : 'none');
      setAudioMessage(message);
      scheduleNextLesson();
    };

    const playLessonAudio = async () => {
      if (!currentLessonHasAudio || !audio) {
        finishWithoutAudio('');
        return;
      }

      setAudioStatus('loading');
      setAudioMessage('');

      try {
        const audioUrl = currentLesson.audioUrl || await withTimeout(
          getAudioDownloadUrlByPath(currentLesson.audioPath),
          AUDIO_LOAD_TIMEOUT_MS,
          'Audio URL loading timed out.',
        );

        if (cancelled) return;

        if (!audioUrl) {
          finishWithoutAudio('Audio unavailable');
          return;
        }

        if (!currentLesson.audioUrl && currentLesson.audioPath) {
          updateLessonAudioUrl(currentLesson.id, audioUrl).catch(() => {});
        }

        await new Promise((resolve, reject) => {
          let settled = false;
          const cleanup = () => {
            window.clearTimeout(loadTimeoutId);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
          };
          const settle = (callback) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback();
          };
          const handleCanPlay = () => settle(resolve);
          const handleError = () => settle(() => reject(new Error('Audio unavailable')));
          const loadTimeoutId = window.setTimeout(
            () => settle(() => reject(new Error('Audio loading timed out.'))),
            AUDIO_LOAD_TIMEOUT_MS,
          );

          audio.addEventListener('canplay', handleCanPlay, { once: true });
          audio.addEventListener('error', handleError, { once: true });
          audio.src = audioUrl;
          audio.load();
        });

        if (cancelled) return;

        await audio.play();
        if (cancelled) return;
        setAudioStatus('playing');

        await new Promise((resolve, reject) => {
          const handleEnded = () => {
            cleanup();
            resolve();
          };
          const handleError = () => {
            cleanup();
            reject(new Error('Audio unavailable'));
          };
          const cleanup = () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
          };
          audio.addEventListener('ended', handleEnded, { once: true });
          audio.addEventListener('error', handleError, { once: true });
        });

        if (cancelled) return;
        setAudioStatus('ended');
        scheduleNextLesson();
      } catch (playError) {
        if (cancelled) return;
        finishWithoutAudio(playError?.message || 'Audio unavailable');
      }
    };

    playLessonAudio();

    return () => {
      cancelled = true;
      clearAdvanceTimer();
      stopAudio();
    };
  }, [currentLesson, currentLessonHasAudio, hasStarted, isPaused, playbackKey]);

  const startBoard = () => {
    if (!currentLesson) return;
    setHasStarted(true);
    setIsPaused(false);
    setPlaybackKey((prev) => prev + 1);
  };

  const togglePause = () => {
    if (!hasStarted) return;
    setIsPaused((prev) => !prev);
    setPlaybackKey((prev) => prev + 1);
  };

  const goToPrevious = () => {
    if (boardLessons.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + boardLessons.length) % boardLessons.length);
    setPlaybackKey((prev) => prev + 1);
  };

  const goToNext = () => {
    if (boardLessons.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % boardLessons.length);
    setPlaybackKey((prev) => prev + 1);
  };

  const restartBoard = () => {
    if (boardLessons.length === 0) return;
    setCurrentIndex(0);
    setHasStarted(true);
    setIsPaused(false);
    setPlaybackKey((prev) => prev + 1);
  };

  const boardStatusLabel = (() => {
    if (!hasStarted) return 'Ready';
    if (isPaused) return 'Paused';
    if (audioStatus === 'playing') return 'Playing audio';
    if (audioStatus === 'loading') return 'Preparing audio';
    return 'Auto board running';
  })();

  return (
    <section className="stack phrase-board-page">
      <div className="phrase-board-header">
        <div>
          <p className="section-subtle">Always-on lesson phrases</p>
          <h2 className="section-title phrase-board-title">Phrase Board</h2>
        </div>
        <p className="phrase-board-interval">Audio, then 5 seconds before the next lesson</p>
      </div>

      {error ? <p className="card error">{error}</p> : null}
      {loading ? <p className="card">Loading Phrase Board...</p> : null}

      {!loading && !error && !currentLesson ? (
        <article className="card empty-state phrase-board-empty">
          <h3 className="section-title">No displayable lessons.</h3>
          <p className="section-subtle">Add English Script text to lessons to show them on the board.</p>
        </article>
      ) : null}

      {!loading && !error && currentLesson ? (
        <article className="card phrase-board-slide" aria-live="polite">
          <div className="phrase-board-meta-row">
            <span className="pill">{currentIndex + 1} / {boardLessons.length}</span>
            <span className="pill">{boardStatusLabel}</span>
          </div>

          <div className="phrase-board-content">
            <p className="section-subtle phrase-board-label">Title</p>
            <h3 className="phrase-board-lesson-title">{getLessonDisplayTitle(currentLesson)}</h3>

            <p className="section-subtle phrase-board-label">English Script</p>
            <p className="phrase-board-script">{String(currentLesson.scriptEn || '').trim()}</p>

            <p className="section-subtle phrase-board-label">Translation</p>
            <p className="phrase-board-translation">
              {String(currentLesson.scriptJa || '').trim() || 'No translation yet.'}
            </p>
          </div>

          <div className="phrase-board-controls">
            <button className="btn" disabled={hasStarted} onClick={startBoard} type="button">
              Start Board
            </button>
            <button className="btn ghost" disabled={!hasStarted} onClick={togglePause} type="button">
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn ghost" onClick={goToPrevious} type="button">
              Previous
            </button>
            <button className="btn ghost" onClick={goToNext} type="button">
              Next
            </button>
            <button className="btn ghost" onClick={restartBoard} type="button">
              Restart
            </button>
          </div>

          <div className="phrase-board-audio" aria-live="polite">
            <audio ref={audioRef} preload="auto" />
            {audioStatus === 'loading' ? <p className="section-subtle">Preparing audio...</p> : null}
            {audioStatus === 'playing' ? <p className="section-subtle">Audio playing</p> : null}
            {audioStatus === 'none' ? <p className="section-subtle">No audio for this lesson</p> : null}
            {audioStatus === 'unavailable' ? <p className="section-subtle">Audio unavailable</p> : null}
            {audioMessage ? <p className="error">{audioMessage}</p> : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}
