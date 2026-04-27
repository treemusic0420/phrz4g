import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { deleteCategory, ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { sortCategories } from '../utils/lessons';

export default function CategoriesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedCategories, loadedLessons] = await Promise.all([
        ensureInitialCategories(LOCAL_USER_ID),
        fetchLessons(LOCAL_USER_ID),
      ]);
      setCategories(sortCategories(loadedCategories));
      setLessons(loadedLessons);
    } catch (err) {
      setError(`カテゴリの取得に失敗しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const lessonCountMap = useMemo(() => {
    const map = new Map();
    lessons.forEach((lesson) => {
      const key = lesson.categoryId || '__unset__';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [lessons]);

  const handleDelete = async (category) => {
    const count = lessonCountMap.get(category.id) || 0;
    if (count > 0) {
      setError('このカテゴリには教材が紐づいているため削除できません');
      return;
    }

    if (!window.confirm(`カテゴリ「${category.name}」を削除しますか？`)) return;

    try {
      await deleteCategory(category.id);
      await loadData();
    } catch (err) {
      setError(`カテゴリ削除に失敗しました: ${err?.message || '不明なエラー'}`);
    }
  };

  return (
    <section className="stack">
      <div className="row between">
        <h2 className="section-title">カテゴリ管理</h2>
        <button className="btn" onClick={() => navigate('/categories/new')} type="button">
          カテゴリ追加
        </button>
      </div>

      {error ? <p className="card error">{error}</p> : null}

      {loading ? <p>読み込み中...</p> : null}

      {!loading && categories.length === 0 ? (
        <article className="card empty-state">
          <p>カテゴリがありません。</p>
          <Link className="btn" to="/categories/new">カテゴリを追加する</Link>
        </article>
      ) : null}

      {!loading && categories.length > 0
        ? categories.map((category) => {
          const lessonCount = lessonCountMap.get(category.id) || 0;
          return (
            <article className="card category-manage-card" key={category.id}>
              <div className="row between wrap gap-sm">
                <div>
                  <h3 className="section-title">{category.name}</h3>
                  <p className="section-subtle">slug: {category.slug}</p>
                </div>
                <span className="pill">教材数: {lessonCount}</span>
              </div>
              <p>order: {category.order}</p>
              <p>状態: {category.isActive ? '有効' : '無効'}</p>
              <div className="row gap-sm wrap">
                <Link className="btn ghost" to={`/categories/${category.id}/edit`}>編集</Link>
                <button className="btn danger-ghost" onClick={() => handleDelete(category)} type="button">削除</button>
              </div>
            </article>
          );
        })
        : null}
    </section>
  );
}
