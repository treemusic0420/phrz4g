import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import LessonImageThumbnail from '../components/LessonImageThumbnail';
import { useAuth } from '../contexts/AuthContext';
import { createStudyLog, fetchLessonById, fetchLessons, updateLessonStats } from '../lib/firestore';
import {
  filterLessonsByCategoryAndMonth,
  getLessonDisplayTitle,
  hasInstantRecallContent,
  hasLessonAudio,
  sortLessonsForMonthTraining,
} from '../utils/lessons';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

const RATINGS = [
  { id: 'couldntDoIt', label: 'Couldn’t do it' },
  { id: 'almost', label: 'Almost' },
  { id: 'didIt', label: 'Did it' },
];

export default function InstantRecallPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [lesson, setLesson] = useState(null);
  const [monthLessons, setMonthLessons] = useState([]);
  const [startedAt, setStartedAt] = useState(new Date());
  const [isFinished, setIsFinished] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [autoPlayToken, setAutoPlayToken] = useState(0);
  const [autoPlayMessage, setAutoPlayMessage] = useState('');
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get('mode');
  const categoryId = searchParams.get('categoryId') || '';
  const registeredMonth = searchParams.get('registeredMonth') || '';
  const isMonthMode = mode === 'month' && categoryId && registeredMonth;
  const monthLabel = getRegisteredMonthLabel(registeredMonth);
  const fallbackAudioContentType =
    lesson?.audioPath?.split('.').pop()?.toLowerCase() === 'm4a'
      ? 'audio/mp4'
      : lesson?.audioPath?.split('.').pop()?.toLowerCase() === 'mp3'
        ? 'audio/mpeg'
        : lesson?.audioPath?.split('.').pop()?.toLowerCase() === 'wav'
          ? 'audio/wav'
          : '';
  const canPlayAudio = showAnswer && hasLessonAudio(lesson);
  const lessonAudioStopAndUnloadRef = useRef(null);
  const suppressAudioAutoplayRef = useRef(true);
  const backToListButtonRef = useRef(null);

  useEffect(() => {
    if (!isMonthMode) {
      setMonthLessons([]);
      return;
    }
    fetchLessons(userId).then((lessons) => {
      const filtered = filterLessonsByCategoryAndMonth(lessons, categoryId, registeredMonth);
      const ready = sortLessonsForMonthTraining(filtered.filter((row) => hasInstantRecallContent(row)));
      setMonthLessons(ready);
    });
  }, [isMonthMode, userId, categoryId, registeredMonth]);

  useEffect(() => {
    let isActive = true;
    suppressAudioAutoplayRef.current = true;
    lessonAudioStopAndUnloadRef.current?.();
    setStartedAt(new Date());
    setShowAnswer(false);
    setAutoPlayMessage('');
    fetchLessonById(id).then((doc) => {
      if (!isActive) return;
      if (!doc || doc.userId !== userId) return navigate('/lessons');
      setLesson(doc);
      suppressAudioAutoplayRef.current = false;
      setAutoPlayToken((prev) => prev + 1);
    });
    return () => {
      isActive = false;
      suppressAudioAutoplayRef.current = true;
    };
  }, [id, userId, navigate]);

  const monthIndex = useMemo(() => monthLessons.findIndex((row) => row.id === id), [monthLessons, id]);
  const nextLesson = monthIndex >= 0 ? monthLessons[monthIndex + 1] : null;
  const hasValidProgress = monthIndex >= 0 && monthLessons.length > 0;
  const completedLessonTitles = monthLessons.map((item) => getLessonDisplayTitle(item));

  const backToLessonList = () => {
    lessonAudioStopAndUnloadRef.current?.();
    navigate(`/lessons/category/${categoryId}/month/${registeredMonth}`);
  };

  const completeAndGoNext = async (instantRecallRating) => {
    if (!lesson || !showAnswer || !hasValidProgress) return;
    suppressAudioAutoplayRef.current = true;
    lessonAudioStopAndUnloadRef.current?.();
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.floor((endedAt - startedAt) / 1000));
    await createStudyLog({
      userId,
      lessonId: lesson.id,
      trainingType: 'instantRecall',
      startedAt,
      endedAt,
      durationSeconds,
      completed: true,
      instantRecallRating,
    });
    await updateLessonStats(lesson.id, 'instantRecall', durationSeconds, {});

    if (nextLesson) {
      navigate(`/lessons/${nextLesson.id}/instant-recall?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}`);
      return;
    }
    setIsFinished(true);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      if (!showAnswer) {
        event.preventDefault();
        setShowAnswer(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAnswer]);

  useEffect(() => {
    if (!isFinished) return;
    window.requestAnimationFrame(() => backToListButtonRef.current?.focus());
  }, [isFinished]);

  if (!isMonthMode) {
    return <section className="stack"><article className="card"><h2 className="section-title">Please start from a monthly lesson list.</h2><div className="row gap-sm wrap"><Link className="btn ghost" to="/lessons">Back to Lessons</Link></div></article></section>;
  }

  if (!lesson) return <p>Loading...</p>;

  if (monthLessons.length === 0) {
    return (
      <section className="stack">
        <article className="card">
          <h2 className="section-title">Instant Recall</h2>
          <p>No lessons available for Instant Recall. Please add translations first.</p>
          <div className="row gap-sm wrap">
            <button className="btn ghost" type="button" onClick={backToLessonList}>Back to List</button>
          </div>
        </article>
      </section>
    );
  }

  if (isFinished) {
    return (
      <section className="stack">
        <article className="card training-finished-card">
          <h2 className="section-title">Finished!</h2>
          <p className="section-subtle">You completed all lessons in this month.</p>
          <p className="training-finished-summary">Completed lessons: {completedLessonTitles.length}</p>
          <div className="row gap-sm wrap training-finished-action">
            <button ref={backToListButtonRef} className="btn ghost" type="button" onClick={backToLessonList}>Back to List</button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="training-page-header">
        <h2 className="section-title training-page-title">Instant Recall: {lesson.title}</h2>
        {lesson.imageUrl ? <LessonImageThumbnail imageUrl={lesson.imageUrl} title={lesson.title} fit="cover" className="training-lesson-thumbnail-compact" /> : null}
      </div>
      <p className="section-subtle">{monthLabel} ・ {hasValidProgress ? monthIndex + 1 : '-'} / {monthLessons.length || '-'}</p>
      <article className="card instant-recall-translation-card"><h3>Translation</h3><pre>{lesson.scriptJa}</pre></article>
      {!showAnswer ? (
        <div className="row gap-sm wrap">
          <button className="btn" type="button" onClick={() => setShowAnswer(true)}>Show Answer</button>
          <button className="btn ghost" type="button" onClick={backToLessonList}>Back to List</button>
        </div>
      ) : (
        <>
          <article className="card instant-recall-answer-card"><h3>English Script</h3><pre>{lesson.scriptEn}</pre></article>
          {canPlayAudio ? (
            <AudioControls
              key={lesson.id}
              lessonId={lesson.id}
              audioUrl={lesson.audioUrl}
              audioContentType={lesson.audioContentType || fallbackAudioContentType}
              shouldAutoPlay={false}
              isAutoPlaySuppressed={() => suppressAudioAutoplayRef.current}
              autoPlayToken={autoPlayToken}
              onAutoPlayBlocked={setAutoPlayMessage}
              onRegisterControls={(controls) => {
                lessonAudioStopAndUnloadRef.current = controls?.stopAndUnloadCurrentAudio || null;
              }}
            />
          ) : null}
          {autoPlayMessage ? <p className="section-subtle">{autoPlayMessage}</p> : null}
          <div className="shadowing-rating-actions">
            {RATINGS.map((rating) => (
              <button key={rating.id} className="btn" type="button" onClick={() => completeAndGoNext(rating.id)}>
                {rating.label}
              </button>
            ))}
            <button className="btn ghost" type="button" onClick={backToLessonList}>Back to List</button>
          </div>
        </>
      )}
    </section>
  );
}
