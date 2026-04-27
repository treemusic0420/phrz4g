import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import { LOCAL_USER_ID } from '../lib/auth';
import { createStudyLog, fetchLessonById, fetchLessons, updateLessonStats } from '../lib/firestore';
import { filterLessonsByCategoryAndMonth, sortLessonsForMonthTraining } from '../utils/lessons';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

export default function ShadowingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [lesson, setLesson] = useState(null);
  const [monthLessons, setMonthLessons] = useState([]);
  const [showEn, setShowEn] = useState(true);
  const [showJa, setShowJa] = useState(false);
  const [startedAt, setStartedAt] = useState(new Date());
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get('mode');
  const categoryId = searchParams.get('categoryId') || '';
  const registeredMonth = searchParams.get('registeredMonth') || '';
  const isMonthMode = mode === 'month' && categoryId && registeredMonth;
  const fileExtension = lesson?.audioPath?.split('.').pop()?.toLowerCase() || '';
  const fallbackAudioContentType =
    fileExtension === 'm4a' ? 'audio/mp4' : fileExtension === 'mp3' ? 'audio/mpeg' : fileExtension === 'wav' ? 'audio/wav' : '';

  useEffect(() => {
    setStartedAt(new Date());
    setShowEn(true);
    setShowJa(false);
    fetchLessonById(id).then((doc) => {
      if (!doc || doc.userId !== LOCAL_USER_ID) return navigate('/lessons');
      setLesson(doc);
    });
  }, [id, navigate]);

  useEffect(() => {
    if (!isMonthMode) {
      setMonthLessons([]);
      return;
    }
    fetchLessons(LOCAL_USER_ID).then((lessons) => {
      const filtered = filterLessonsByCategoryAndMonth(lessons, categoryId, registeredMonth);
      setMonthLessons(sortLessonsForMonthTraining(filtered));
    });
  }, [isMonthMode, categoryId, registeredMonth]);

  const monthIndex = monthLessons.findIndex((monthLesson) => monthLesson.id === id);
  const nextLesson = monthIndex >= 0 ? monthLessons[monthIndex + 1] : null;
  const isLastLesson = monthLessons.length > 0 && monthIndex === monthLessons.length - 1;
  const hasValidProgress = monthIndex >= 0 && monthLessons.length > 0;
  const monthLabel = getRegisteredMonthLabel(registeredMonth);
  const [isFinished, setIsFinished] = useState(false);

  const completeAndGoNext = async () => {
    if (!lesson) return;
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.floor((endedAt - startedAt) / 1000));
    await createStudyLog({
      userId: LOCAL_USER_ID,
      lessonId: lesson.id,
      trainingType: 'shadowing',
      startedAt,
      endedAt,
      durationSeconds,
      completed: true,
    });
    await updateLessonStats(lesson.id, 'shadowing', durationSeconds);
    if (nextLesson) {
      navigate(
        `/lessons/${nextLesson.id}/shadowing?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}`,
      );
      return;
    }
    setIsFinished(true);
  };

  if (!isMonthMode) {
    return (
      <section className="stack">
        <article className="card">
          <h2 className="section-title">Please start from a monthly lesson list.</h2>
          <div className="row gap-sm wrap">
            <Link className="btn ghost" to="/lessons">
              Back to Lessons
            </Link>
          </div>
        </article>
      </section>
    );
  }

  if (!lesson) return <p>Loading...</p>;

  if (isFinished) {
    return (
      <section className="stack">
        <article className="card">
          <h2 className="section-title">Finished!</h2>
          <p className="section-subtle">You completed all lessons in this month.</p>
          <div className="row gap-sm wrap">
            <Link className="btn ghost" to={`/lessons/category/${categoryId}/month/${registeredMonth}`}>
              Back to Lesson List
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="stack">
      <h2 className="section-title">Shadowing: {lesson.title}</h2>
      <p className="section-subtle">
        {monthLabel} ・ {hasValidProgress ? monthIndex + 1 : '-'} / {monthLessons.length || '-'}
      </p>
      <AudioControls
        key={lesson.id}
        audioUrl={lesson.audioUrl}
        audioContentType={lesson.audioContentType || fallbackAudioContentType}
      />
      <div className="row gap-sm wrap">
        <button onClick={() => setShowEn((v) => !v)} type="button">English Script {showEn ? 'Hide' : 'Show'}</button>
        <button onClick={() => setShowJa((v) => !v)} type="button">Japanese Translation {showJa ? 'Hide' : 'Show'}</button>
        <button onClick={completeAndGoNext} type="button" disabled={!hasValidProgress}>
          {isLastLesson ? 'Finish' : 'Next'}
        </button>
      </div>
      {showEn ? <article className="card"><h3>English Script</h3><pre>{lesson.scriptEn}</pre></article> : null}
      {showJa ? <article className="card"><h3>Japanese Translation</h3><pre>{lesson.scriptJa || '-'}</pre></article> : null}
    </section>
  );
}
