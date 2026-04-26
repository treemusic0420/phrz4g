import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLessons } from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime, formatSeconds } from '../utils/format';

export default function LessonsPage() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    fetchLessons(user.uid).then(setLessons);
  }, [user.uid]);

  return (
    <section className="stack">
      <div className="row between">
        <h2>教材一覧</h2>
        <Link className="btn" to="/lessons/new">
          教材追加
        </Link>
      </div>
      {lessons.length === 0 ? <p className="card">教材がありません。まず1件作成してください。</p> : null}
      {lessons.map((lesson) => (
        <article className="card" key={lesson.id}>
          <h3>{lesson.title}</h3>
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
