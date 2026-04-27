import { useEffect, useRef, useState } from 'react';
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
  const [recordingUrl, setRecordingUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const discardOnStopRef = useRef(false);
  const timerRef = useRef(null);
  const stopResolverRef = useRef(null);

  const clearRecordingTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearRecorderRefs = () => {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    discardOnStopRef.current = false;
    stopResolverRef.current = null;
  };

  const revokeRecordingUrl = () => {
    setRecordingUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const stopRecording = (discard = false) =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        clearRecordingTimer();
        stopMediaTracks();
        setIsRecording(false);
        resolve();
        return;
      }
      discardOnStopRef.current = discard;
      stopResolverRef.current = resolve;
      recorder.stop();
    });

  const discardRecording = async () => {
    await stopRecording(true);
    clearRecordingTimer();
    stopMediaTracks();
    revokeRecordingUrl();
    setRecordingSeconds(0);
    setIsRecording(false);
    setRecordingError('');
    clearRecorderRefs();
  };

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const getPreferredMimeType = () => {
    if (typeof window === 'undefined' || !window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') {
      return '';
    }
    const mimeCandidates = ['audio/webm', 'audio/mp4', 'audio/mpeg'];
    return mimeCandidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
  };

  const startRecording = async () => {
    setRecordingError('');
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      setRecordingError('Recording is not supported in this browser.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError('Recording is not supported in this browser.');
      return;
    }
    await discardRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      discardOnStopRef.current = false;
      const mimeType = getPreferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearRecordingTimer();
        stopMediaTracks();
        const shouldDiscard = discardOnStopRef.current;
        if (shouldDiscard) {
          chunksRef.current = [];
          setIsRecording(false);
          setRecordingSeconds(0);
          const resolver = stopResolverRef.current;
          clearRecorderRefs();
          if (resolver) resolver();
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        chunksRef.current = [];
        revokeRecordingUrl();
        setRecordingUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        const resolver = stopResolverRef.current;
        clearRecorderRefs();
        if (resolver) resolver();
      };
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      clearRecordingTimer();
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      stopMediaTracks();
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      setRecordingError(
        denied
          ? 'Microphone access was denied. Please allow microphone access and try again.'
          : 'Unable to start recording. Please check your microphone and try again.',
      );
    }
  };

  const completeAndGoNext = async () => {
    if (!lesson) return;
    await discardRecording();
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

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      stopMediaTracks();
      revokeRecordingUrl();
      clearRecorderRefs();
    };
  }, []);

  useEffect(() => {
    setRecordingError('');
    void discardRecording();
  }, [id]);

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
      <article className="card"><h3>English Script</h3><pre>{lesson.scriptEn}</pre></article>
      <AudioControls
        key={lesson.id}
        audioUrl={lesson.audioUrl}
        audioContentType={lesson.audioContentType || fallbackAudioContentType}
      />
      <article className="card recording-card">
        <h3>Your Recording</h3>
        <div className="stack">
          {isRecording ? <p className="section-subtle">Recording... {formatRecordingTime(recordingSeconds)}</p> : null}
          {recordingError ? <p className="error">{recordingError}</p> : null}
          <div className="row gap-sm wrap">
            <button type="button" onClick={startRecording} disabled={isRecording}>
              Start Recording
            </button>
            {isRecording ? (
              <button type="button" className="btn danger-ghost" onClick={() => stopRecording(false)}>
                Stop Recording
              </button>
            ) : null}
            {recordingUrl ? (
              <button type="button" className="btn ghost" onClick={startRecording}>
                Re-record
              </button>
            ) : null}
          </div>
          {recordingUrl ? <audio controls src={recordingUrl} /> : null}
        </div>
      </article>
      <div className="row gap-sm wrap">
        <button onClick={() => setShowJa((v) => !v)} type="button">Translation {showJa ? 'Hide' : 'Show'}</button>
        <button onClick={completeAndGoNext} type="button" disabled={!hasValidProgress}>
          {isLastLesson ? 'Finish' : 'Next'}
        </button>
        <Link className="btn ghost" to={`/lessons/category/${categoryId}/month/${registeredMonth}`} onClick={() => void discardRecording()}>
          Back to Lesson List
        </Link>
      </div>
      {showJa ? <article className="card"><h3>Translation</h3><pre>{lesson.scriptJa || '-'}</pre></article> : null}
    </section>
  );
}
