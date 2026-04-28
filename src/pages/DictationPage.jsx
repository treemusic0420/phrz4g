import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import LessonImageThumbnail from '../components/LessonImageThumbnail';
import { LOCAL_USER_ID } from '../lib/auth';
import {
  createDictationAttempt,
  createStudyLog,
  fetchLessons,
  fetchLessonById,
  updateLessonStats,
} from '../lib/firestore';
import { normalizeForDictation } from '../utils/dictation';
import { diffWords } from '../utils/diff';
import { playDictationCompleteSound, playDictationWrongKeySound } from '../utils/feedbackSound';
import { filterLessonsByCategoryAndMonth, hasLessonAudio, sortLessonsForMonthTraining } from '../utils/lessons';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

const splitToChars = (text) => Array.from(text || '');

const WHITESPACE_REGEX = /\s/;
const ALLOWED_DICTATION_CHAR_REGEX = /^[A-Za-z0-9.,?!'"\-:;()/&@]$/;
const FULL_WIDTH_ASCII_REGEX = /[！-～]/g;
const AUTO_INSERTED_PUNCTUATION = new Set([',', '.', "'", '’', '?']);
const isAutoInsertedDictationChar = (char) =>
  WHITESPACE_REGEX.test(char) || AUTO_INSERTED_PUNCTUATION.has(char);

const normalizeWidth = (char) =>
  char.replace(FULL_WIDTH_ASCII_REGEX, (value) => String.fromCharCode(value.charCodeAt(0) - 0xfee0));

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

    if (isAutoInsertedDictationChar(char)) {
      currentGroup.push({
        id: `auto-${char}-${index}`,
        char,
        type: 'auto',
      });
    } else {
      currentGroup.push({
        id: `${char}-${index}-${expectedIndex}`,
        char,
        expectedIndex,
        type: 'slot',
      });
      expectedIndex += 1;
    }

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
    setWrongSlotIndex(-1);
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

  const normalizedInput = useMemo(() => normalizeForDictation(inputText), [inputText]);
  const normalizedScript = useMemo(() => normalizeForDictation(lesson?.scriptEn || ''), [lesson?.scriptEn]);
  const diff = useMemo(() => diffWords(normalizedInput, normalizedScript), [normalizedInput, normalizedScript]);
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
  const nextButtonRef = useRef(null);
  const backToListButtonRef = useRef(null);
  const audioToggleRef = useRef(null);
  const wrongInputTimeoutRef = useRef(null);
  const inputTextRef = useRef('');
  const isComposingRef = useRef(false);
  const [wrongSlotIndex, setWrongSlotIndex] = useState(-1);
  const slotGroups = useMemo(() => buildSlotGroups(lesson?.scriptEn || ''), [lesson?.scriptEn]);
  const expectedChars = useMemo(
    () => slotGroups.flatMap((group) => group.filter((item) => item.type === 'slot').map((slot) => slot.char)),
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
    if (wrongInputTimeoutRef.current) window.clearTimeout(wrongInputTimeoutRef.current);
    wrongInputTimeoutRef.current = window.setTimeout(() => {
      setWrongSlotIndex(-1);
    }, 420);
    playDictationWrongKeySound().catch(() => {});
  };

  const evaluateCompletedInput = async (nextText) => {
    if (!lesson) return;
    const result = normalizeForDictation(nextText) === normalizeForDictation(lesson.scriptEn);
    setHasChecked(true);
    setIsCorrect(result);
    if (result) {
      await playDictationCompleteSound();
      window.requestAnimationFrame(() => {
        nextButtonRef.current?.focus();
      });
    }
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
      if (isAutoInsertedDictationChar(rawChar)) return false;
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

    if (wrongIndex >= 0) {
      triggerWrongFeedback(wrongIndex);
    } else {
      setWrongSlotIndex(-1);
    }

    const isComplete = nextInput.length === maxInputLength && maxInputLength > 0;
    if (isComplete) {
      evaluateCompletedInput(nextText).catch(() => {});
    } else {
      setHasChecked(false);
      setIsCorrect(null);
    }
  };

  const normalizeAndFilterChars = (candidateChars) => {
    const existingLength = splitToChars(inputTextRef.current).length;
    let acceptedCount = 0;
    let hasRejectedChar = false;
    const filteredChars = [];

    candidateChars.forEach((rawChar) => {
      const normalizedChar = normalizeWidth(rawChar);
      if (!normalizedChar || isAutoInsertedDictationChar(normalizedChar)) return;

      const pointer = existingLength + acceptedCount;
      const expectedChar = expectedChars[pointer];
      const isAllowedByList = ALLOWED_DICTATION_CHAR_REGEX.test(normalizedChar);
      const isAllowedExpectedSymbol = Boolean(expectedChar) && normalizedChar === expectedChar;

      if (!isAllowedByList && !isAllowedExpectedSymbol) {
        hasRejectedChar = true;
        return;
      }

      filteredChars.push(normalizedChar);
      acceptedCount += 1;
    });

    return { filteredChars, hasRejectedChar };
  };

  const handleRawInputChars = (candidateChars, options = {}) => {
    const { stopOnWrong = true, playRejectedFeedback = true } = options;
    const { filteredChars, hasRejectedChar } = normalizeAndFilterChars(candidateChars);

    if (filteredChars.length > 0) {
      applyInputChars(filteredChars, { stopOnWrong });
    } else if (hasRejectedChar && playRejectedFeedback && maxInputLength > 0) {
      triggerWrongFeedback(Math.min(splitToChars(inputTextRef.current).length, maxInputLength - 1));
    }
  };

  const removeLastInputChar = () => {
    const prevChars = splitToChars(inputTextRef.current);
    if (prevChars.length === 0) return;
    const nextText = prevChars.slice(0, -1).join('');
    inputTextRef.current = nextText;
    setInputText(nextText);
    setWrongSlotIndex(-1);
    setHasChecked(false);
    setIsCorrect(null);
  };

  const getCharStatus = (slotIndex) => {
    if (slotIndex < inputChars.length) return 'dictation-slot-correct';
    if (slotIndex === inputChars.length) {
      if (wrongSlotIndex === slotIndex) return 'dictation-slot-wrong-pulse';
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

  const focusDictationInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      hiddenInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!lesson || isFinished) return;
    focusDictationInput();
  }, [lesson?.id, isFinished]);

  useEffect(() => {
    if (!isFinished) return;
    window.requestAnimationFrame(() => {
      backToListButtonRef.current?.focus();
    });
  }, [isFinished]);

  const onHiddenInputChange = (event) => {
    if (isComposingRef.current) return;
    const typedChars = splitToChars(event.target.value);
    if (typedChars.length > 0) handleRawInputChars(typedChars, { stopOnWrong: true, playRejectedFeedback: true });
    event.target.value = '';
  };

  const onHiddenInputKeyDown = (event) => {
    if (isComposingRef.current || event.nativeEvent.isComposing) return;
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
      handleRawInputChars([event.key], { stopOnWrong: true, playRejectedFeedback: true });
    }
  };

  const onHiddenInputPaste = (event) => {
    const text = event.clipboardData.getData('text');
    if (!text) return;
    event.preventDefault();
    handleRawInputChars(splitToChars(text), { stopOnWrong: true, playRejectedFeedback: true });
  };

  const onHiddenInputCompositionStart = () => {
    isComposingRef.current = true;
  };

  const onHiddenInputCompositionEnd = (event) => {
    isComposingRef.current = false;
    const committedText = event.data || event.currentTarget.value;
    if (committedText) {
      handleRawInputChars(splitToChars(committedText), { stopOnWrong: true, playRejectedFeedback: true });
    }
    event.currentTarget.value = '';
  };

  const isSpaceKeyEvent = (event) => event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space';

  const onDictationSectionKeyDownCapture = (event) => {
    if (!isSpaceKeyEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    audioToggleRef.current?.();
  };

  const handleBackToLessonList = () => {
    navigate(`/lessons/category/${categoryId}/month/${registeredMonth}`);
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
            <button
              ref={backToListButtonRef}
              className="btn ghost"
              type="button"
              onClick={handleBackToLessonList}
            >
              Back to Lesson List
            </button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="stack" onKeyDownCapture={onDictationSectionKeyDownCapture}>
      <div className="training-page-header">
        <h2 className="section-title training-page-title">Dictation: {lesson.title}</h2>
        {lesson.imageUrl ? (
          <LessonImageThumbnail
            imageUrl={lesson.imageUrl}
            title={lesson.title}
            fit="cover"
            className="training-lesson-thumbnail-compact"
          />
        ) : null}
      </div>
      <p className="section-subtle">
        {monthLabel} ・ {hasValidProgress ? monthIndex + 1 : '-'} / {monthLessons.length || '-'}
      </p>
      <article className="card dictation-input-card">
        <div
          className="dictation-slot-container"
          onClick={focusDictationInput}
          onTouchStart={focusDictationInput}
          onFocus={focusDictationInput}
          role="textbox"
          aria-label="Dictation character input"
          tabIndex={0}
          >
          <input
            ref={hiddenInputRef}
            className="dictation-hidden-input"
            type="text"
            onChange={onHiddenInputChange}
            onKeyDown={onHiddenInputKeyDown}
            onPaste={onHiddenInputPaste}
            onCompositionStart={onHiddenInputCompositionStart}
            onCompositionEnd={onHiddenInputCompositionEnd}
          />
          {slotGroups.map((group, groupIndex) => (
            <span className="dictation-slot-word" key={`group-${groupIndex}`}>
              {group.map((slot) => {
                if (slot.type === 'auto') {
                  return (
                    <span key={slot.id} className="dictation-auto-char" aria-hidden="true">
                      {slot.char}
                    </span>
                  );
                }
                const actualChar = inputChars[slot.expectedIndex];
                const slotStatus = getCharStatus(slot.expectedIndex);
                return (
                  <span key={slot.id} className={`dictation-slot ${slotStatus}`}>
                    {actualChar || ''}
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      </article>
      <AudioControls
        key={lesson.id}
        audioUrl={lesson.audioUrl}
        audioContentType={lesson.audioContentType || fallbackAudioContentType}
        shouldAutoPlay={canPlayAudio}
        autoPlayToken={autoPlayToken}
        onAutoPlayBlocked={setAutoPlayMessage}
        onAutoPlaySettled={focusDictationInput}
        onRegisterControls={(controls) => {
          audioToggleRef.current = controls?.togglePlayback || null;
        }}
      />
      {autoPlayMessage ? <p className="section-subtle">{autoPlayMessage}</p> : null}
      <div className="row gap-sm wrap">
        <button
          ref={nextButtonRef}
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
            {diff.every((item) => item.match) ? (
              <span className="diff-match">No differences.</span>
            ) : (
              diff.map((item) => (
                <span className={item.match ? 'diff-match' : 'diff-miss'} key={item.index}>
                  {item.match ? item.correctWord : `[${item.inputWord || '∅'} → ${item.correctWord || '∅'}]`}
                </span>
              ))
            )}
          </div>
        </article>
      ) : null}
    </section>
  );
}
