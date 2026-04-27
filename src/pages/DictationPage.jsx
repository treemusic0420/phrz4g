import { useEffect, useMemo, useRef, useState } from 'react';
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
import { filterLessonsByCategoryAndMonth, hasLessonAudio, sortLessonsForMonthTraining } from '../utils/lessons';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

const splitToChars = (text) => Array.from(text || '');

const buildSlotGroups = (chars) => {
  const groups = [];
  let currentGroup = [];
  chars.forEach((char, index) => {
    currentGroup.push(index);
    if (char === ' ') {
      groups.push(currentGroup);
      currentGroup = [];
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
};

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
      const audioReady = filtered.filter((monthLesson) => hasLessonAudio(monthLesson));
      setMonthLessons(sortLessonsForMonthTraining(audioReady));
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
  const canPlayAudio = hasLessonAudio(lesson);
  const hiddenInputRef = useRef(null);
  const expectedChars = useMemo(() => splitToChars(lesson?.scriptEn || ''), [lesson?.scriptEn]);
  const inputChars = useMemo(() => splitToChars(inputText), [inputText]);
  const slotGroups = useMemo(() => buildSlotGroups(expectedChars), [expectedChars]);
  const maxInputLength = expectedChars.length;

  const appendInputChars = (newChars) => {
    if (newChars.length === 0) return;
    setInputText((prev) => {
      const prevChars = splitToChars(prev);
      if (prevChars.length >= maxInputLength) return prev;
      const available = maxInputLength - prevChars.length;
      return `${prev}${newChars.slice(0, available).join('')}`;
    });
    setHasChecked(false);
    setIsCorrect(null);
  };

  const removeLastInputChar = () => {
    setInputText((prev) => {
      const prevChars = splitToChars(prev);
      if (prevChars.length === 0) return prev;
      return prevChars.slice(0, -1).join('');
    });
    setHasChecked(false);
    setIsCorrect(null);
  };

  const getCharStatus = (expectedChar, actualChar, checked, isActive) => {
    if (!checked) {
      if (isActive) return 'dictation-slot-active';
      return actualChar === undefined ? 'dictation-slot-empty' : 'dictation-slot-filled';
    }
    if (actualChar === undefined) return 'dictation-slot-missing';
    return actualChar === expectedChar ? 'dictation-slot-correct' : 'dictation-slot-incorrect';
  };

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

  const focusInput = () => {
    hiddenInputRef.current?.focus();
  };

  const onHiddenInputChange = (event) => {
    const typedChars = splitToChars(event.target.value);
    if (typedChars.length > 0) appendInputChars(typedChars);
    event.target.value = '';
  };

  const onHiddenInputKeyDown = (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      removeLastInputChar();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      appendInputChars([event.key]);
    }
  };

  const onHiddenInputPaste = (event) => {
    const text = event.clipboardData.getData('text');
    if (!text) return;
    event.preventDefault();
    appendInputChars(splitToChars(text));
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

  if (!canPlayAudio) {
    return (
      <section className="stack">
        <article className="card">
          <h2 className="section-title">No audio lessons available in this month.</h2>
          <div className="row gap-sm wrap">
            <Link className="btn ghost" to={`/lessons/category/${categoryId}/month/${registeredMonth}`}>
              Back to Lesson List
            </Link>
          </div>
        </article>
      </section>
    );
  }

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
      <article className="card dictation-input-card">
        <h3>Your Input</h3>
        <p className="section-subtle">Tap/click the slots and type one character at a time.</p>
        <div
          className="dictation-slot-container"
          onClick={focusInput}
          onTouchStart={focusInput}
          onFocus={focusInput}
          role="textbox"
          aria-label="Dictation character input"
          tabIndex={0}
        >
          <input
            ref={hiddenInputRef}
            className="dictation-hidden-input"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            onChange={onHiddenInputChange}
            onKeyDown={onHiddenInputKeyDown}
            onPaste={onHiddenInputPaste}
          />
          {slotGroups.map((group, groupIndex) => (
            <span className="dictation-slot-word" key={`group-${groupIndex}`}>
              {group.map((charIndex) => {
                const expectedChar = expectedChars[charIndex];
                const actualChar = inputChars[charIndex];
                const isSpace = expectedChar === ' ';
                const slotStatus = getCharStatus(
                  expectedChar,
                  actualChar,
                  hasChecked,
                  !hasChecked && charIndex === inputChars.length,
                );
                return (
                  <span
                    key={`slot-${charIndex}`}
                    className={`dictation-slot ${isSpace ? 'dictation-slot-space' : ''} ${slotStatus}`}
                  >
                    {!isSpace && actualChar ? actualChar : ''}
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      </article>
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
