import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import { LOCAL_USER_ID } from '../lib/auth';
import {
  createDictationAttempt,
  createStudyLog,
  fetchLessons,
  fetchLessonById,
  updateLessonStats,
} from '../lib/firestore';
import { isDictationAnswerCorrect } from '../utils/dictation';
import { diffWords } from '../utils/diff';
import { playCorrectSound, playIncorrectSound } from '../utils/feedbackSound';
import { filterLessonsByCategoryAndMonth, sortLessonsForMonthTraining } from '../utils/lessons';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

export default function DictationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [lesson, setLesson] = useState(null);
  const [monthLessons, setMonthLessons] = useState([]);
  const [inputText, setInputText] = useState('');
  const [hasChecked, setHasChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [startedAt, setStartedAt] = useState(new Date());
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const mode = searchParams.get('mode');
  const categoryId = searchParams.get('categoryId') || '';
  const registeredMonth = searchParams.get('registeredMonth') || '';
  const isMonthMode = mode === 'month' && categoryId && registeredMonth;

  useEffect(() => {
    setStartedAt(new Date());
    setInputText('');
    setHasChecked(false);
    setIsCorrect(null);
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

  const diff = useMemo(() => diffWords(inputText, lesson?.scriptEn || ''), [inputText, lesson?.scriptEn]);
  const monthIndex = useMemo(
    () => monthLessons.findIndex((monthLesson) => monthLesson.id === id),
    [monthLessons, id],
  );
  const nextLesson = monthIndex >= 0 ? monthLessons[monthIndex + 1] : null;
  const isLastLesson = monthLessons.length > 0 && monthIndex === monthLessons.length - 1;
  const hasValidProgress = monthIndex >= 0 && monthLessons.length > 0;
  const monthLabel = useMemo(() => getRegisteredMonthLabel(registeredMonth), [registeredMonth]);
  const fileExtension = lesson?.audioPath?.split('.').pop()?.toLowerCase() || '';
  const fallbackAudioContentType =
    fileExtension === 'm4a' ? 'audio/mp4' : fileExtension === 'mp3' ? 'audio/mpeg' : fileExtension === 'wav' ? 'audio/wav' : '';
  const [isFinished, setIsFinished] = useState(false);

  const completeAndGoNext = async () => {
    if (!lesson) return;
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.floor((endedAt - startedAt) / 1000));

    await createStudyLog({
      userId: LOCAL_USER_ID,
      lessonId: lesson.id,
      trainingType: 'dictation',
      startedAt,
      endedAt,
      durationSeconds,
      completed: true,
    });

    await createDictationAttempt({
      userId: LOCAL_USER_ID,
      lessonId: lesson.id,
      inputText,
      correctText: lesson.scriptEn,
      diffResult: diff,
      durationSeconds,
    });

    await updateLessonStats(lesson.id, 'dictation', durationSeconds);

    if (nextLesson) {
      navigate(
        `/lessons/${nextLesson.id}/dictation?mode=month&categoryId=${categoryId}&registeredMonth=${registeredMonth}`,
      );
      return;
    }

    setIsFinished(true);
  };

  const onInputChange = (event) => {
    setInputText(event.target.value);
    setHasChecked(false);
    setIsCorrect(null);
  };

  const checkAnswer = async () => {
    if (!lesson) return;
    const result = isDictationAnswerCorrect(inputText, lesson.scriptEn);
    setHasChecked(true);
    setIsCorrect(result);
    if (result) {
      await playCorrectSound();
      return;
    }
    await playIncorrectSound();
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
      <h2 className="section-title">Dictation: {lesson.title}</h2>
      <p className="section-subtle">
        {monthLabel} ・ {hasValidProgress ? monthIndex + 1 : '-'} / {monthLessons.length || '-'}
      </p>
      <AudioControls
        key={lesson.id}
        audioUrl={lesson.audioUrl}
        audioContentType={lesson.audioContentType || fallbackAudioContentType}
      />
      <label>
        Your Input
        <textarea rows="8" value={inputText} onChange={onInputChange} />
      </label>
      <div className="row gap-sm wrap">
        <button onClick={checkAnswer} type="button">Check Answer</button>
        <button
          onClick={completeAndGoNext}
          type="button"
          disabled={!hasValidProgress}
        >
          {isLastLesson ? 'Finish' : 'Next'}
        </button>
      </div>
      {hasChecked ? (
        <article className={`card answer-result-card ${isCorrect ? 'correct' : 'incorrect'}`}>
          <h3>{isCorrect ? 'Correct!' : 'Not quite yet'}</h3>
          <p className="section-subtle">
            {isCorrect ? 'Nice work. You matched the script.' : 'Check the differences below.'}
          </p>
        </article>
      ) : null}
      <article className="card">
        <p className="section-subtle">
          Answer status: {hasChecked ? (isCorrect ? 'Correct' : 'Not correct yet') : 'Not checked'}
        </p>
      </article>
      {hasChecked ? (
        <article className="card">
          <h3>Correct Script</h3>
          <pre>{lesson.scriptEn}</pre>
        </article>
      ) : null}
      {hasChecked ? (
        <article className="card">
          <h3>Difference (Simple)</h3>
          <div className="diff-wrap">
            {diff.map((item) => (
              <span className={item.match ? 'diff-match' : 'diff-miss'} key={item.index}>
                {item.match ? item.correctWord : `[${item.inputWord || '∅'} → ${item.correctWord || '∅'}]`}
              </span>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
