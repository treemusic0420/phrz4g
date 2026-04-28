import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureInitialCategories, createLesson } from '../lib/firestore';
import { LOCAL_USER_ID } from '../lib/auth';
import { sortCategories } from '../utils/lessons';
import { DIFFICULTY_OPTIONS, normalizeDifficulty } from '../utils/difficulty';

const QUICK_ADD_SUCCESS_MESSAGE = 'Saved.';

const buildAutoTitle = (script = '') => {
  const normalized = String(script || '').replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 80);
};

export default function QuickAddLessonPage() {
  const scriptRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [scriptEn, setScriptEn] = useState('');
  const [scriptJa, setScriptJa] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    scriptRef.current?.focus();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      setError('');
      try {
        const loaded = await ensureInitialCategories(LOCAL_USER_ID);
        const activeCategories = sortCategories(loaded).filter((category) => category.isActive);
        setCategories(activeCategories);
        setCategoryId((prev) => prev || activeCategories[0]?.id || '');
      } catch {
        setCategories([]);
        setError('Failed to load categories.');
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  const categoryOptions = useMemo(() => sortCategories(categories), [categories]);

  const focusScript = () => {
    window.requestAnimationFrame(() => {
      scriptRef.current?.focus();
    });
  };

  const clearScriptFields = () => {
    setScriptEn('');
    setScriptJa('');
    setError('');
    setSuccessMessage('');
    focusScript();
  };

  const validateBeforeSave = () => {
    const normalizedScript = String(scriptEn || '').trim();
    if (!normalizedScript) return 'English Script is required.';
    if (!categoryId) return 'Please select a category.';
    if (!difficulty) return 'Please select a difficulty.';
    return '';
  };

  const onSave = async () => {
    if (isSaving) return;

    setError('');
    setSuccessMessage('');

    const validationMessage = validateBeforeSave();
    if (validationMessage) {
      setError(validationMessage);
      focusScript();
      return;
    }

    setIsSaving(true);
    try {
      const title = buildAutoTitle(scriptEn);
      await createLesson({
        userId: LOCAL_USER_ID,
        title,
        scriptEn: scriptEn.trim(),
        scriptJa: scriptJa.trim(),
        categoryId,
        difficulty: normalizeDifficulty(difficulty),
        memo: '',
        audioPath: '',
        audioUrl: '',
        audioContentType: '',
        imagePath: '',
        imageUrl: '',
      });

      setScriptEn('');
      setScriptJa('');
      setSuccessMessage(QUICK_ADD_SUCCESS_MESSAGE);
      focusScript();
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    await onSave();
  };

  const onFormKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    if (!event.metaKey && !event.ctrlKey) return;
    event.preventDefault();
    onSave();
  };

  return (
    <section className="card quick-add-card">
      <div className="stack">
        <div>
          <h2 className="section-title">Quick Add</h2>
          <p className="section-subtle">Add a lesson now. Add audio later from Missing Audio.</p>
        </div>

        <form className="stack" onSubmit={onSubmit} onKeyDown={onFormKeyDown}>
          <label>
            English Script
            <textarea
              ref={scriptRef}
              placeholder="Type an English sentence or phrase..."
              required
              rows="5"
              value={scriptEn}
              onChange={(event) => setScriptEn(event.target.value)}
            />
          </label>

          <label>
            Japanese Translation
            <textarea
              placeholder="Add a Japanese translation..."
              rows="4"
              value={scriptJa}
              onChange={(event) => setScriptJa(event.target.value)}
            />
          </label>

          <label>
            Category
            <select
              required
              disabled={isLoadingCategories || categoryOptions.length === 0}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {isLoadingCategories ? <option value="">Loading categories...</option> : null}
              {!isLoadingCategories && categoryOptions.length === 0 ? <option value="">No categories yet</option> : null}
              {!isLoadingCategories
                ? categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                : null}
            </select>
          </label>

          {!isLoadingCategories && categoryOptions.length === 0 ? (
            <p className="error">
              No categories yet. <Link to="/categories">Create a category</Link> first.
            </p>
          ) : null}

          <label>
            Difficulty
            <select
              required
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === 'normal' ? 'Medium' : option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="row gap-sm wrap">
            <button disabled={isSaving || isLoadingCategories || categoryOptions.length === 0} type="submit">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn ghost" disabled={isSaving} type="button" onClick={clearScriptFields}>
              Clear
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
          {successMessage ? <p className="section-subtle">{successMessage}</p> : null}

          <div className="row gap-sm wrap">
            <Link className="btn ghost" to="/lessons">View Lessons</Link>
            <Link className="btn ghost" to="/lessons/missing-audio">Missing Audio</Link>
            <Link className="btn ghost" to="/lessons/missing-photo">Missing Photo</Link>
          </div>
        </form>
      </div>
    </section>
  );
}
