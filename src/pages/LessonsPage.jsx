import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLessons } from '../lib/firestore';
import { LOCAL_USER_ID } from '../lib/auth';
import { formatDateTime, formatSeconds } from '../utils/format';

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function LessonsPage() {
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadLessons = async () => {
      setError(null);
      try {
        const fetched = await fetchLessons(LOCAL_USER_ID);
        const sorted = [...fetched].sort((a, b) => {
          const aTime = Math.max(toMillis(a.updatedAt), toMillis(a.createdAt));
          const bTime = Math.max(toMillis(b.updatedAt), toMillis(b.createdAt));
          return bTime - aTime;
        });
        setLessons(sorted);
      } catch (fetchError) {
        setLessons([]);
        setError(fetchError);
      }
    };
    loadLessons();
  }, []);

  return (
    <section className="stack">
      <div className="row between">
        <h2 className="section-title">教材一覧</h2>
        <Link className="btn" to="/lessons/new">
          教材追加
        </Link>
      </div>
      <details className="debug-panel">
        <summary>debug info</summary>
        <p>debug.userId: {LOCAL_USER_ID}</p>
        <p>debug.lessonCount: {lessons.length}</p>
        {error ? (
          <p className="error">
            debug.error: {error?.code || 'unknown'} / {error?.message || '不明なエラー'}
          </p>
        ) : null}
      </details>
      {error ? (
        <p className="card error">
          教材一覧の取得に失敗しました: {error?.code || 'unknown'} / {error?.message || '不明なエラー'}
        </p>
      ) : null}
      {!error && lessons.length === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">教材がありません</h3>
          <p className="section-subtle">まずは「教材追加」から1件作成してください。</p>
        </article>
      ) : null}
      {lessons.map((lesson) => (
        <article className="card" key={lesson.id}>
          <h3 className="section-title">{lesson.title}</h3>
          <p>カテゴリ: {lesson.category || '-'}</p>
          <p>難易度: {lesson.difficulty || '未設定'}</p>
          <p>最終学習日: {formatDateTime(lesson.lastStudiedAt)}</p>
          <p>ディクテーション回数: {lesson.dictationCount || 0}</p>
          <p>シャドーイング回数: {lesson.shadowingCount || 0}</p>
          <p>累計学習時間: {formatSeconds(lesson.totalStudySeconds || 0)}</p>
          <div className="row gap-sm wrap">
            <Link className="btn ghost" to={`/lessons/${lesson.id}`}>
              詳細
            </Link>
            <Link className="btn ghost" to={`/lessons/${lesson.id}/dictation`}>
              ディクテーション
            </Link>
            <Link className="btn ghost" to={`/lessons/${lesson.id}/shadowing`}>
              シャドーイング
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
