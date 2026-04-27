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

const WHITESPACE_REGEX = /\s/;

const buildSlotGroups = (script = '') => {
  const chars = splitToChars(script);
  const groups = [];
  let currentGroup = [];
  let expectedIndex = 0;

  chars.forEach((char, index) => {
    if (WHITESPACE_REGEX.test(char)) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [];
      return;
    }

    currentGroup.push({
      id: `${char}-${index}-${expectedIndex}`,
      char,
      expectedIndex,
    });
    expectedIndex += 1;

    if (index === chars.length - 1 && currentGroup.length > 0) {
      groups.push(currentGroup);
    }
  });

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
  const [autoPlayToken, setAutoPlayToken] = useState(0);
  const [autoPlayMessage, setAutoPlayMessage] = useState('');
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
    setAutoPlayMessage('');
    setAutoPlayToken((prev) => prev + 1);
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
  const wrongInputTimeoutRef = useRef(null);
  const inputTextRef = useRef('');
  const [wrongSlotIndex, setWrongSlotIndex] = useState(-1);
  const [showTryAgain, setShowTryAgain] = useState(false);
  const slotGroups = useMemo(() => buildSlotGroups(lesson?.scriptEn || ''), [lesson?.scriptEn]);
  const expectedChars = useMemo(
    () => slotGroups.flatMap((group) => group.map((slot) => slot.char)),
    [slotGroups],
  );
  const inputChars = useMemo(() => splitToChars(inputText), [inputText]);
  const maxInputLength = expectedChars.length;

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  useEffect(
    () => () => {
      if (wrongInputTimeoutRef.current) window.clearTimeout(wrongInputTimeoutRef.current);
    },
    [],
  );

  const triggerWrongFeedback = (index) => {
    setWrongSlotIndex(index);
    setShowTryAgain(true);
    if (wrongInputTimeoutRef.current) window.clearTimeout(wrongInputTimeoutRef.current);
    wrongInputTimeoutRef.current = window.setTimeout(() => {
      setShowTryAgain(false);
      setWrongSlotIndex(-1);
    }, 420);
  };

  const applyInputChars = (candidateChars, options = {}) => {
    const { stopOnWrong = false } = options;
    if (candidateChars.length === 0) return;
    const nextInput = [];
    const existing = splitToChars(inputTextRef.current);
    let pointer = existing.length;
    let wrongIndex = -1;

    existing.forEach((char) => nextInput.push(char));

    candidateChars.some((rawChar) => {
      if (WHITESPACE_REGEX.test(rawChar)) return false;
      if (pointer >= maxInputLength) return true;

      const expectedChar = expectedChars[pointer];
      if (!expectedChar) return true;

      if (rawChar.toLocaleLowerCase() === expectedChar.toLocaleLowerCase()) {
        nextInput.push(expectedChar);
        pointer += 1;
        return false;
      }

      wrongIndex = pointer;
      return stopOnWrong;
    });

    const nextText = nextInput.join('');
    inputTextRef.current = nextText;
    setInputText(nextText);
    if (wrongIndex >= 0) triggerWrongFeedback(wrongIndex);
    else if (showTryAgain) {
      setShowTryAgain(false);
      setWrongSlotIndex(-1);
    }
    setHasChecked(false);
    setIsCorrect(null);
  };

  const removeLastInputChar = () => {
    const prevChars = splitToChars(inputTextRef.current);
    if (prevChars.length === 0) return;
    const nextText = prevChars.slice(0, -1).join('');
    inputTextRef.current = nextText;
    setInputText(nextText);
    setShowTryAgain(false);
    setWrongSlotIndex(-1);
    setHasChecked(false);
    setIsCorrect(null);
  };

  const getCharStatus = (slotIndex) => {
    if (slotIndex < inputChars.length) return 'dictation-slot-correct';
    if (slotIndex === inputChars.length) {
      if (showTryAgain && wrongSlotIndex === slotIndex) return 'dictation-slot-wrong-pulse';
      return 'dictation-slot-active';
    }
    return 'dictation-slot-empty';
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
    if (typedChars.length > 0) applyInputChars(typedChars, { stopOnWrong: true });
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
    if (event.key === ' ') {
      event.preventDefault();
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      applyInputChars([event.key]);
    }
  };

  const onHiddenInputPaste = (event) => {
    const text = event.clipboardData.getData('text');
    if (!text) return;
    event.preventDefault();
    applyInputChars(splitToChars(text), { stopOnWrong: true });
  };

  const checkAnswer = async () => {
    if (!lesson) return;
    const isComplete = inputChars.length === expectedChars.length;
    const result = isComplete && isDictationAnswerCorrect(inputText, lesson.scriptEn);
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
        shouldAutoPlay={canPlayAudio}
        autoPlayToken={autoPlayToken}
        onAutoPlayBlocked={setAutoPlayMessage}
      />
      {autoPlayMessage ? <p className="section-subtle">{autoPlayMessage}</p> : null}
      <article className="card dictation-input-card">
        <h3>Your Input</h3>
        <p className="section-subtle">Type the correct next character. Spaces are skipped automatically.</p>
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
              {group.map((slot) => {
                const actualChar = inputChars[slot.expectedIndex];
                const slotStatus = getCharStatus(slot.expectedIndex);
                return (
                  <span
                    key={slot.id}
                    className={`dictation-slot ${slotStatus}`}
                  >
                    {actualChar || ''}
                  </span>
                );
              })}
            </span>
          ))}
        </div>
        {showTryAgain ? <p className="section-subtle dictation-try-again">Try again</p> : null}
        {inputChars.length === expectedChars.length ? <p className="section-subtle">Ready to check.</p> : null}
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
