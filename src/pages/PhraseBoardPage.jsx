import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchLessons, updateLessonAudioUrl } from '../lib/firestore';
import { getAudioDownloadUrlByPath } from '../lib/storage';
import {
  getLessonDisplayTitle,
  hasLessonAudio,
  sortLessonsByCreatedDescOrder,
} from '../utils/lessons';

const PHRASE_INTERVAL_MS = 5000;
const AUDIO_LOAD_TIMEOUT_MS = 7000;
const DEFAULT_AUTO_STOP_VALUE = '30';
const AUTO_STOP_OPTIONS = [
  { value: '30', label: '30 min', durationMs: 30 * 60 * 1000 },
  { value: '60', label: '60 min', durationMs: 60 * 60 * 1000 },
  { value: 'none', label: 'No auto stop', durationMs: null },
];

const getAutoStopOption = (value) =>
  AUTO_STOP_OPTIONS.find((option) => option.value === value) || AUTO_STOP_OPTIONS[0];

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
  const autoStopTimerRef = useRef(null);
  const [allLessons, setAllLessons] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [audioStatus, setAudioStatus] = useState('idle');
  const [audioMessage, setAudioMessage] = useState('');
  const [autoStopValue, setAutoStopValue] = useState(DEFAULT_AUTO_STOP_VALUE);
  const [autoStopped, setAutoStopped] = useState(false);
  const [boardMessage, setBoardMessage] = useState('');
  const [repeatAll, setRepeatAll] = useState(true);

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
    () => sortLessonsByCreatedDescOrder(allLessons.filter(hasReadableEnglishScript)),
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
  const selectedAutoStopOption = getAutoStopOption(autoStopValue);

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const clearAutoStopTimer = () => {
    if (autoStopTimerRef.current) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  };

  const stopAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };

  const stopBoardAfterOneRound = () => {
    clearAdvanceTimer();
    clearAutoStopTimer();
    stopAudio();
    setHasStarted(false);
    setIsPaused(false);
    setAutoStopped(false);
    setBoardMessage('Stopped after one round.');
    setAudioStatus(currentLessonHasAudio ? 'idle' : 'none');
    setAudioMessage('');
  };

  const advanceToNextLesson = () => {
    if (boardLessons.length === 0) return;
    const isLastLesson = currentIndex >= boardLessons.length - 1;

    if (isLastLesson) {
      if (!repeatAll) {
        stopBoardAfterOneRound();
        return;
      }
      setCurrentIndex(0);
      if (boardLessons.length === 1) setPlaybackKey((prev) => prev + 1);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const scheduleNextLesson = () => {
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      advanceToNextLesson();
    }, PHRASE_INTERVAL_MS);
  };

  const stopBoardForAutoStop = (label) => {
    clearAdvanceTimer();
    clearAutoStopTimer();
    stopAudio();
    setHasStarted(true);
    setIsPaused(true);
    setAutoStopped(true);
    setBoardMessage(`Auto stopped after ${label}.`);
    setAudioStatus(currentLessonHasAudio ? 'idle' : 'none');
    setAudioMessage('');
  };

  useEffect(() => () => {
    clearAdvanceTimer();
    clearAutoStopTimer();
    stopAudio();
  }, []);

  useEffect(() => {
    clearAutoStopTimer();

    if (!hasStarted || isPaused || autoStopped || !selectedAutoStopOption.durationMs) return undefined;

    autoStopTimerRef.current = window.setTimeout(() => {
      autoStopTimerRef.current = null;
      stopBoardForAutoStop(selectedAutoStopOption.label);
    }, selectedAutoStopOption.durationMs);

    return clearAutoStopTimer;
  }, [hasStarted, isPaused, autoStopped, selectedAutoStopOption.durationMs, selectedAutoStopOption.label]);

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
  }, [currentLesson, currentLessonHasAudio, hasStarted, isPaused, playbackKey, repeatAll]);

  const startBoard = () => {
    if (!currentLesson) return;
    setHasStarted(true);
    setIsPaused(false);
    setAutoStopped(false);
    setBoardMessage('');
    setPlaybackKey((prev) => prev + 1);
  };

  const togglePause = () => {
    if (!hasStarted) return;
    if (isPaused) {
      setAutoStopped(false);
      setBoardMessage('');
    }
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
    setAutoStopped(false);
    setBoardMessage('');
    setPlaybackKey((prev) => prev + 1);
  };

  const handleAutoStopChange = (event) => {
    setAutoStopValue(event.target.value);
    setAutoStopped(false);
    setBoardMessage('');
  };

  const boardStatusLabel = (() => {
    if (!hasStarted) return 'Ready';
    if (autoStopped) return 'Auto stopped';
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
        <div className="phrase-board-header-meta">
          <p className="phrase-board-interval">Audio, then 5 seconds before the next lesson</p>
          <p className="phrase-board-interval">Auto stop: {selectedAutoStopOption.label}</p>
        </div>
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
            <span className="pill">Auto stop: {selectedAutoStopOption.label}</span>
            <span className="pill">Repeat All {repeatAll ? 'ON' : 'OFF'}</span>
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

          <div className="phrase-board-settings">
            <label>
              Auto stop
              <select onChange={handleAutoStopChange} value={autoStopValue}>
                {AUTO_STOP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="phrase-board-repeat-toggle">
              <input
                checked={repeatAll}
                onChange={(event) => setRepeatAll(event.target.checked)}
                type="checkbox"
              />
              Repeat All {repeatAll ? 'ON' : 'OFF'}
            </label>
          </div>

          {boardMessage ? <p className="section-subtle phrase-board-message">{boardMessage}</p> : null}

          <div className="phrase-board-controls">
            <button className="btn" disabled={hasStarted && !autoStopped} onClick={startBoard} type="button">
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
