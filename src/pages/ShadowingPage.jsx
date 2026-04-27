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
  const monthLabel = getRegisteredMonthLabel(registeredMonth);

  const complete = async () => {
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
    if (isMonthMode) return;
    navigate(`/lessons/${lesson.id}`);
  };

  if (!lesson) return <p>Loading...</p>;

  return (
    <section className="stack">
      {isMonthMode ? (
        <article className="card">
          <p className="section-subtle">Category ID: {categoryId}</p>
          <p className="section-subtle">Registered Month: {monthLabel}</p>
          <p className="section-subtle">
            {monthIndex + 1 > 0 ? monthIndex + 1 : '-'} / {monthLessons.length || '-'}
          </p>
          <div className="row gap-sm wrap">
            {nextLesson ? (
              <Link
                className="btn"
                to={`/lessons/${nextLesson.id}/shadowing?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}`}
              >
                Next
              </Link>
            ) : (
              <Link className="btn ghost" to={`/lessons/category/${categoryId}/month/${registeredMonth}`}>
                Finished
              </Link>
            )}
            <Link className="btn ghost" to={`/lessons/category/${categoryId}/month/${registeredMonth}`}>
              Back to Lesson List
            </Link>
          </div>
        </article>
      ) : null}
      <h2 className="section-title">Shadowing: {lesson.title}</h2>
      <AudioControls audioUrl={lesson.audioUrl} audioContentType={lesson.audioContentType || fallbackAudioContentType} />
      <div className="row gap-sm wrap">
        <button onClick={() => setShowEn((v) => !v)} type="button">English Script {showEn ? 'Hide' : 'Show'}</button>
        <button onClick={() => setShowJa((v) => !v)} type="button">Japanese Translation {showJa ? 'Hide' : 'Show'}</button>
        <button onClick={complete} type="button">Complete</button>
      </div>
      {showEn ? <article className="card"><h3>English Script</h3><pre>{lesson.scriptEn}</pre></article> : null}
      {showJa ? <article className="card"><h3>Japanese Translation</h3><pre>{lesson.scriptJa || '-'}</pre></article> : null}
    </section>
  );
}
