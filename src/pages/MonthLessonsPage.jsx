import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { formatDateTime, formatSeconds } from '../utils/format';
import {
  DELETED_CATEGORY_LABEL,
  LESSONS_PER_PAGE,
  UNSET_CATEGORY_LABEL,
  filterLessonsByCategoryAndMonth,
  paginateLessons,
  sortLessonsByRecency,
} from '../utils/lessons';
import { getDifficultyLabel } from '../utils/difficulty';
import { getRegisteredMonthLabel } from '../utils/registeredMonth';

const createSnippet = (text = '', maxLength = 120) => {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (!oneLine) return '-';
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength)}…`;
};

export default function MonthLessonsPage() {
  const { categoryId, registeredMonth } = useParams();
  const [allLessons, setAllLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryId, registeredMonth]);

  useEffect(() => {
    const loadLessons = async () => {
      setError(null);
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(LOCAL_USER_ID),
          ensureInitialCategories(LOCAL_USER_ID),
        ]);
        setAllLessons(fetchedLessons);
        setCategories(fetchedCategories);
      } catch (fetchError) {
        setAllLessons([]);
        setCategories([]);
        setError(fetchError);
      }
    };
    loadLessons();
  }, []);

  const categoryName = useMemo(() => {
    if (categoryId === '__unset__') return UNSET_CATEGORY_LABEL;
    const found = categories.find((category) => category.id === categoryId);
    return found?.name || DELETED_CATEGORY_LABEL;
  }, [categories, categoryId]);

  const monthLabel = useMemo(() => getRegisteredMonthLabel(registeredMonth), [registeredMonth]);

  const monthLessons = useMemo(() => {
    const filtered = filterLessonsByCategoryAndMonth(allLessons, categoryId, registeredMonth);
    return sortLessonsByRecency(filtered);
  }, [allLessons, categoryId, registeredMonth]);

  const paging = useMemo(
    () => paginateLessons(monthLessons, currentPage, LESSONS_PER_PAGE),
    [monthLessons, currentPage],
  );

  const shouldShowPaging = paging.total > LESSONS_PER_PAGE;

  return (
    <section className="stack">
      <div className="row between">
        <div>
          <p className="section-subtle">教材 &gt; {categoryName} &gt; {monthLabel}</p>
          <h2 className="section-title">{categoryName} / {monthLabel}</h2>
          <p className="section-subtle">月内教材: {paging.total}件</p>
        </div>
        <Link className="btn ghost" to={`/lessons/category/${categoryId}`}>
          登録月一覧へ戻る
        </Link>
      </div>

      {error ? (
        <p className="card error">
          教材一覧の取得に失敗しました: {error?.code || 'unknown'} / {error?.message || '不明なエラー'}
        </p>
      ) : null}

      {!error && paging.total === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">この月には教材がありません</h3>
          <p className="section-subtle">登録月一覧へ戻って他の月を選択してください。</p>
        </article>
      ) : null}

      {paging.items.map((lesson) => (
        <Link className="card lesson-card-link" key={lesson.id} to={`/lessons/${lesson.id}`}>
          <h3 className="section-title">{lesson.title}</h3>
          <p>難易度: {getDifficultyLabel(lesson.difficulty)}</p>
          <p>英文: {createSnippet(lesson.scriptEn)}</p>
          <p>ディクテーション回数: {lesson.dictationCount || 0}回</p>
          <p>シャドーイング回数: {lesson.shadowingCount || 0}回</p>
          <p>累計学習時間: {formatSeconds(lesson.totalStudySeconds || 0)}</p>
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
