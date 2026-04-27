import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import { LOCAL_USER_ID } from '../lib/auth';
import { createStudyLog, fetchLessonById, updateLessonStats } from '../lib/firestore';

export default function ShadowingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [showEn, setShowEn] = useState(true);
  const [showJa, setShowJa] = useState(false);
  const [startedAt] = useState(new Date());
  const fileExtension = lesson?.audioPath?.split('.').pop()?.toLowerCase() || '';
  const fallbackAudioContentType =
    fileExtension === 'm4a' ? 'audio/mp4' : fileExtension === 'mp3' ? 'audio/mpeg' : fileExtension === 'wav' ? 'audio/wav' : '';

  useEffect(() => {
    fetchLessonById(id).then((doc) => {
      if (!doc || doc.userId !== LOCAL_USER_ID) return navigate('/lessons');
      setLesson(doc);
    });
  }, [id, navigate, LOCAL_USER_ID]);

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
    navigate(`/lessons/${lesson.id}`);
  };

  if (!lesson) return <p>Loading...</p>;

  return (
    <section className="stack">
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
