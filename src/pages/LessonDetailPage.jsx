import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import { fetchLessonById } from '../lib/firestore';
import { LOCAL_USER_ID } from '../lib/auth';
import { formatDateTime, formatSeconds } from '../utils/format';

export default function LessonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);

  useEffect(() => {
    fetchLessonById(id).then((doc) => {
      if (!doc || doc.userId !== LOCAL_USER_ID) return navigate('/lessons');
      setLesson(doc);
    });
  }, [id, navigate, LOCAL_USER_ID]);

  if (!lesson) return <p>読み込み中...</p>;

  return (
    <section className="stack">
      <article className="card">
        <h2>{lesson.title}</h2>
        <p>カテゴリ: {lesson.category || '-'}</p>
        <p>難易度: {lesson.difficulty || '未設定'}</p>
        <p>英文</p>
        <pre>{lesson.scriptEn}</pre>
        <p>日本語訳</p>
        <pre>{lesson.scriptJa || '-'}</pre>
        <p>メモ</p>
        <pre>{lesson.memo || '-'}</pre>
        {lesson.audioUrl ? <AudioControls audioUrl={lesson.audioUrl} /> : null}
        <h3>学習概要</h3>
        <p>最終学習日: {formatDateTime(lesson.lastStudiedAt)}</p>
        <p>ディクテーション回数: {lesson.dictationCount || 0}</p>
        <p>シャドーイング回数: {lesson.shadowingCount || 0}</p>
        <p>累計学習時間: {formatSeconds(lesson.totalStudySeconds || 0)}</p>
      </article>
      <div className="row gap-sm wrap">
        <Link className="btn" to={`/lessons/${id}/dictation`}>ディクテーション</Link>
        <Link className="btn" to={`/lessons/${id}/shadowing`}>シャドーイング</Link>
        <Link className="btn ghost" to={`/lessons/${id}/edit`}>編集</Link>
      </div>
    </section>
  );
}
