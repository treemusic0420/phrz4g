import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLessons } from '../lib/firestore';
import { LOCAL_USER_ID } from '../lib/auth';
import { formatDateTime, formatSeconds } from '../utils/format';
import { groupLessonsByCategory } from '../utils/lessons';

export default function LessonsPage() {
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadLessons = async () => {
      setError(null);
      try {
        const fetched = await fetchLessons(LOCAL_USER_ID);
        setLessons(fetched);
      } catch (fetchError) {
        setLessons([]);
        setError(fetchError);
      }
    };
    loadLessons();
  }, []);
  const categorySummaries = groupLessonsByCategory(lessons);

  return (
    <section className="stack">
      <div className="row between">
        <h2 className="section-title">カテゴリ一覧</h2>
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
          <div className="row gap-sm wrap center">
            <Link className="btn" to="/lessons/new">
              教材を追加する
            </Link>
          </div>
        </article>
      ) : null}
      {categorySummaries.map((category) => (
        <Link className="card category-card" key={category.key} to={`/lessons/category/${category.key}`}>
          <div className="row between">
            <h3 className="section-title">{category.name}</h3>
            <span className="pill">{category.count}件</span>
          </div>
          <p>最終更新: {formatDateTime(category.latestActivityTime)}</p>
          <p>合計学習時間: {formatSeconds(category.totalStudySeconds)}</p>
          <p className="section-subtle">カテゴリ内の教材を表示</p>
        </Link>
      ))}
    </section>
  );
}
