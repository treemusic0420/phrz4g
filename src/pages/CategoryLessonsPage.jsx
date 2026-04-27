import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { fetchLessons } from '../lib/firestore';
import { formatDateTime } from '../utils/format';
import {
  LESSONS_PER_PAGE,
  keyToCategory,
  normalizeCategory,
  paginateLessons,
  sortLessonsByRecency,
} from '../utils/lessons';

const createSnippet = (text = '', maxLength = 120) => {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (!oneLine) return '-';
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength)}…`;
};

export default function CategoryLessonsPage() {
  const { categoryKey } = useParams();
  const categoryName = keyToCategory(categoryKey);
  const [allLessons, setAllLessons] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryKey]);

  useEffect(() => {
    const loadLessons = async () => {
      setError(null);
      try {
        const fetched = await fetchLessons(LOCAL_USER_ID);
        setAllLessons(fetched);
      } catch (fetchError) {
        setAllLessons([]);
        setError(fetchError);
      }
    };
    loadLessons();
  }, []);

  const categoryLessons = useMemo(() => {
    const filtered = allLessons.filter((lesson) => normalizeCategory(lesson.category) === categoryName);
    return sortLessonsByRecency(filtered);
  }, [allLessons, categoryName]);

  const paging = useMemo(
    () => paginateLessons(categoryLessons, currentPage, LESSONS_PER_PAGE),
    [categoryLessons, currentPage],
  );

  const shouldShowPaging = paging.total > LESSONS_PER_PAGE;

  return (
    <section className="stack">
      <div className="row between">
        <div>
          <h2 className="section-title">{categoryName}</h2>
          <p className="section-subtle">カテゴリ内教材: {paging.total}件</p>
        </div>
        <Link className="btn ghost" to="/lessons">
          カテゴリ一覧へ戻る
        </Link>
      </div>

      {error ? (
        <p className="card error">
          教材一覧の取得に失敗しました: {error?.code || 'unknown'} / {error?.message || '不明なエラー'}
        </p>
      ) : null}

      {!error && paging.total === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">このカテゴリの教材はありません</h3>
          <p className="section-subtle">カテゴリ一覧に戻って他のカテゴリを選択してください。</p>
        </article>
      ) : null}

      {paging.items.map((lesson) => (
        <Link className="card lesson-card-link" key={lesson.id} to={`/lessons/${lesson.id}`}>
          <h3 className="section-title">{lesson.title}</h3>
          <p>難易度: {lesson.difficulty || '未設定'}</p>
          <p>英文: {createSnippet(lesson.scriptEn)}</p>
          <p>
            学習回数: D {lesson.dictationCount || 0} / S {lesson.shadowingCount || 0}
          </p>
          <p>最終学習日: {formatDateTime(lesson.lastStudiedAt)}</p>
          <p className="section-subtle">タップして教材詳細へ</p>
        </Link>
      ))}

      {shouldShowPaging ? (
        <div className="card pagination-box">
          <div className="row gap-sm wrap center">
            <button
              className="btn ghost"
              disabled={paging.page <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              type="button"
            >
              前へ
            </button>
            <p>
              {paging.page} / {paging.totalPages}
            </p>
            <button
              className="btn ghost"
              disabled={paging.page >= paging.totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(paging.totalPages, prev + 1))}
              type="button"
            >
              次へ
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
