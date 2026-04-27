import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import { LOCAL_USER_ID } from '../lib/auth';
import {
  createDictationAttempt,
  createStudyLog,
  fetchLessonById,
  updateLessonStats,
} from '../lib/firestore';
import { diffWords } from '../utils/diff';

export default function DictationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [inputText, setInputText] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [startedAt] = useState(new Date());

  useEffect(() => {
    fetchLessonById(id).then((doc) => {
      if (!doc || doc.userId !== LOCAL_USER_ID) return navigate('/lessons');
      setLesson(doc);
    });
  }, [id, navigate, LOCAL_USER_ID]);

  const diff = useMemo(() => diffWords(inputText, lesson?.scriptEn || ''), [inputText, lesson?.scriptEn]);
  const fileExtension = lesson?.audioPath?.split('.').pop()?.toLowerCase() || '';
  const fallbackAudioContentType =
    fileExtension === 'm4a' ? 'audio/mp4' : fileExtension === 'mp3' ? 'audio/mpeg' : fileExtension === 'wav' ? 'audio/wav' : '';

  const complete = async () => {
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
    navigate(`/lessons/${lesson.id}`);
  };

  if (!lesson) return <p>読み込み中...</p>;

  return (
    <section className="stack">
      <h2 className="section-title">ディクテーション: {lesson.title}</h2>
      <AudioControls audioUrl={lesson.audioUrl} audioContentType={lesson.audioContentType || fallbackAudioContentType} />
      <label>
        聞き取り入力
        <textarea rows="8" value={inputText} onChange={(e) => setInputText(e.target.value)} />
      </label>
      <div className="row gap-sm wrap">
        <button onClick={() => setShowAnswer((v) => !v)} type="button">正解表示</button>
        <button onClick={complete} type="button">完了</button>
      </div>
      {showAnswer ? (
        <article className="card">
          <h3>正解英文</h3>
          <pre>{lesson.scriptEn}</pre>
        </article>
      ) : null}
      <article className="card">
        <h3>差分表示（簡易）</h3>
        <div className="diff-wrap">
          {diff.map((item) => (
            <span className={item.match ? 'diff-match' : 'diff-miss'} key={item.index}>
              {item.match ? item.correctWord : `[${item.inputWord || '∅'} → ${item.correctWord || '∅'}]`}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}
