import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
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
        const loadedCategories = sortCategories(await ensureInitialCategories(LOCAL_USER_ID));
        setCategories(loadedCategories);

        if (mode === 'edit' && id) {
          const current = await fetchCategoryById(id);
          if (!current || current.userId !== LOCAL_USER_ID) {
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
        setError(`カテゴリ取得に失敗しました: ${err?.message || '不明なエラー'}`);
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
      setError('カテゴリ名は必須です。');
      return;
    }
    if (!slug) {
      setError('slugは必須です。');
      return;
    }
    if (!Number.isFinite(order)) {
      setError('orderは数値で入力してください。');
      return;
    }

    const duplicated = categories.some((category) => category.slug === slug && category.id !== id);
    if (duplicated) {
      setError(getDuplicateSlugError());
      return;
    }

    const payload = {
      userId: LOCAL_USER_ID,
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
      setError(`カテゴリ保存エラー: ${err?.message || '不明なエラー'}`);
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">{mode === 'create' ? 'カテゴリ追加' : 'カテゴリ編集'}</h2>
      {loading ? <p>読み込み中...</p> : null}
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
            <span>有効</span>
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div className="row gap-sm wrap">
            <button type="submit">保存</button>
            <Link className="btn ghost" to="/categories">キャンセル</Link>
          </div>
        </form>
      ) : null}
    </section>
  );
}
