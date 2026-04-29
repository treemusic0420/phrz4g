import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createCategory, ensureInitialCategories, fetchCategoryById, updateCategory } from '../lib/firestore';
import { getDuplicateSlugError, normalizeName, normalizeSlug } from '../utils/categories';
import { sortCategories } from '../utils/lessons';

const defaultForm = {
  name: '',
  slug: '',
  order: '',
  isActive: true,
};

export default function CategoryFormPage({ mode }) {
  const { user } = useAuth();
  const userId = user?.uid || ''; 
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState(defaultForm);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const loadedCategories = sortCategories(await ensureInitialCategories(userId));
        setCategories(loadedCategories);

        if (mode === 'edit' && id) {
          const current = await fetchCategoryById(id);
          if (!current || current.userId !== userId) {
            navigate('/categories');
            return;
          }
          setForm({
            name: current.name || '',
            slug: current.slug || '',
            order: String(current.order ?? ''),
            isActive: current.isActive !== false,
          });
        }
      } catch (err) {
        setError(`Failed to load category: ${err?.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, mode, navigate]);

  const maxOrder = useMemo(
    () => categories.reduce((max, category) => Math.max(max, Number(category.order) || 0), 0),
    [categories],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const name = normalizeName(form.name);
    const slug = normalizeSlug(form.slug);
    const order = form.order === '' ? maxOrder + 10 : Number(form.order);

    if (!name) {
      setError('Category name is required.');
      return;
    }
    if (!slug) {
      setError('Slug is required.');
      return;
    }
    if (!Number.isFinite(order)) {
      setError('Order must be a number.');
      return;
    }

    const duplicated = categories.some((category) => category.slug === slug && category.id !== id);
    if (duplicated) {
      setError(getDuplicateSlugError());
      return;
    }

    const payload = {
      userId: userId,
      name,
      slug,
      order,
      isActive: !!form.isActive,
    };

    try {
      if (mode === 'create') {
        await createCategory(payload);
      } else {
        await updateCategory(id, payload);
      }
      navigate('/categories');
    } catch (err) {
      setError(`Failed to save category: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">{mode === 'create' ? 'Add Category' : 'Edit Category'}</h2>
      {loading ? <p>Loading...</p> : null}
      {!loading ? (
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            slug
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </label>
          <label>
            order
            <input
              inputMode="numeric"
              placeholder={String(maxOrder + 10)}
              value={form.order}
              onChange={(e) => setForm({ ...form, order: e.target.value })}
            />
          </label>
          <label className="row gap-sm">
            <input
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              type="checkbox"
            />
            <span>Active</span>
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div className="row gap-sm wrap">
            <button type="submit">Save</button>
            <Link className="btn ghost" to="/categories">Cancel</Link>
          </div>
        </form>
      ) : null}
    </section>
  );
}
