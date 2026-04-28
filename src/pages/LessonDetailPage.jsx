import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import { ensureInitialCategories, fetchLessonById, updateLessonAudioUrl } from '../lib/firestore';
import { LOCAL_USER_ID } from '../lib/auth';
import { getAudioDownloadUrlByPath } from '../lib/storage';
import { formatDateTime, formatSeconds } from '../utils/format';
import { getDifficultyLabel, getDifficultyStyle } from '../utils/difficulty';

const getExtFromPath = (path = '') => path.split('.').pop()?.toLowerCase() || '';
const inferTypeByExt = (ext) => {
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  return '';
};
const isUnsupportedAudioFormat = (ext, contentType = '') =>
  ext === 'm4a' || contentType === 'audio/mp4' || contentType === 'audio/x-m4a';

export default function LessonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState('');
  const [audioLoadStatus, setAudioLoadStatus] = useState('idle');
  const [categories, setCategories] = useState([]);
  const [audioErrorMessage, setAudioErrorMessage] = useState('');
  const fileExtension = getExtFromPath(lesson?.audioPath || '');
  const audioContentType = lesson?.audioContentType || inferTypeByExt(fileExtension);
  const unsupportedFormat = isUnsupportedAudioFormat(fileExtension, audioContentType);
  const hasAudio = !!(lesson?.audioUrl || lesson?.audioPath);

  useEffect(() => {
    fetchLessonById(id).then((doc) => {
      if (!doc || doc.userId !== LOCAL_USER_ID) return navigate('/lessons');
      setLesson(doc);
    });
  }, [id, navigate, LOCAL_USER_ID]);


  useEffect(() => {
    ensureInitialCategories(LOCAL_USER_ID)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;

    const resolveUrl = async () => {
      setAudioErrorMessage('');
      setAudioLoadStatus('idle');
      if (unsupportedFormat) {
        setResolvedAudioUrl('');
        return;
      }
      if (!hasAudio) {
        setResolvedAudioUrl('');
        return;
      }
      if (lesson.audioUrl) {
        setResolvedAudioUrl(lesson.audioUrl);
        return;
      }

      if (!lesson.audioPath) return;

      setAudioLoadStatus('loading');
      try {
        const url = await getAudioDownloadUrlByPath(lesson.audioPath);
        if (cancelled) return;
        setResolvedAudioUrl(url);
        await updateLessonAudioUrl(lesson.id, url).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        setResolvedAudioUrl('');
        setAudioLoadStatus('error');
        setAudioErrorMessage(err.message || 'Failed to resolve audio URL from audioPath.');
      }
    };

    resolveUrl();
    return () => {
      cancelled = true;
    };
  }, [lesson, unsupportedFormat, hasAudio]);

  if (!lesson) return <p>Loading...</p>;
  const difficultyStyle = getDifficultyStyle(lesson.difficulty);

  return (
    <section className="stack">
      <article className={`card difficulty-card ${difficultyStyle.tone}`}>
        <h2 className="section-title">{lesson.title}</h2>
        <p>Category: {lesson.categoryId ? (categories.find((category) => category.id === lesson.categoryId)?.name || 'Deleted category') : 'Not set'}</p>
        <div className="row gap-sm wrap">
          <p>Difficulty:</p>
          <span className={`pill difficulty-pill ${difficultyStyle.tone}`}>
            {getDifficultyLabel(lesson.difficulty)}
          </span>
        </div>
        <p className="section-subtle">English Script</p>
        {lesson.imageUrl ? <img className="lesson-detail-image" src={lesson.imageUrl} alt={`${lesson.title} visual`} /> : null}
        <pre className="mono">{lesson.scriptEn}</pre>
        <p>Translation</p>
        <pre>{lesson.scriptJa || '-'}</pre>
        <p>Notes</p>
        <pre>{lesson.memo || '-'}</pre>
        {!hasAudio ? (
          <p className="section-subtle">No audio file yet.</p>
        ) : unsupportedFormat ? (
          <p className="error">This lesson uses an unsupported audio format. Please re-upload it as MP3.</p>
        ) : (
          <AudioControls
            audioUrl={resolvedAudioUrl}
            audioContentType={audioContentType}
            onStatusChange={setAudioLoadStatus}
            onErrorMessage={setAudioErrorMessage}
          />
        )}
        <details className="debug-panel">
          <summary>audio debug</summary>
          <p>audioPath: {lesson.audioPath ? 'yes' : 'no'}</p>
          <p>audioUrl: {lesson.audioUrl ? 'yes' : 'no'}</p>
          <p>resolvedAudioUrl: {resolvedAudioUrl ? 'yes' : 'no'}</p>
          <p>audioContentType: {audioContentType || '-'}</p>
          <p>file extension: {fileExtension || '-'}</p>
          <p>audio load status: {audioLoadStatus}</p>
          <p>audio error message: {audioErrorMessage || '-'}</p>
        </details>
        <p className="section-subtle">Only MP3 files are currently supported.</p>
        <h3>Study Summary</h3>
        <p>Last studied: {formatDateTime(lesson.lastStudiedAt)}</p>
        <p>Dictation attempts: {lesson.dictationCount || 0}</p>
        <p>Shadowing attempts: {lesson.shadowingCount || 0}</p>
        <p>Total study time: {formatSeconds(lesson.totalStudySeconds || 0)}</p>
      </article>
      <div className="row gap-sm wrap">
        <Link className="btn ghost" to={`/lessons/${id}/edit`}>Edit</Link>
      </div>
    </section>
  );
}
