import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteCategory, ensureInitialCategories, fetchLessons } from '../lib/firestore';
import { sortCategories } from '../utils/lessons';

export default function CategoriesPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
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
        ensureInitialCategories(userId),
        fetchLessons(userId),
      ]);
      setCategories(sortCategories(loadedCategories));
      setLessons(loadedLessons);
    } catch (err) {
      setError(`Failed to load categories: ${err?.message || 'Unknown error'}`);
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
      setError('This category cannot be deleted because it has linked lessons.');
      return;
    }

    if (!window.confirm(`Delete category "${category.name}"? This action cannot be undone.`)) return;

    try {
      await deleteCategory(category.id);
      await loadData();
    } catch (err) {
      setError(`Failed to delete category: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <section className="stack">
      <div className="row between">
        <h2 className="section-title">Manage Categories</h2>
        <button className="btn" onClick={() => navigate('/categories/new')} type="button">
          Add Category
        </button>
      </div>

      {error ? <p className="card error">{error}</p> : null}

      {loading ? <p>Loading...</p> : null}

      {!loading && categories.length === 0 ? (
        <article className="card empty-state">
          <p>No categories yet.</p>
          <Link className="btn" to="/categories/new">Add Category</Link>
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
                <span className="pill">Lessons: {lessonCount}</span>
              </div>
              <p>order: {category.order}</p>
              <p>Status: {category.isActive ? 'Active' : 'Inactive'}</p>
              <div className="row gap-sm wrap">
                <Link className="btn ghost" to={`/categories/${category.id}/edit`}>Edit</Link>
                <button className="btn danger-ghost" onClick={() => handleDelete(category)} type="button">Delete</button>
              </div>
            </article>
          );
        })
        : null}
    </section>
  );
}
