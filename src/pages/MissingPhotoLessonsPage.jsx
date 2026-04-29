import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ensureInitialCategories, fetchLessons, updateLessonImage } from '../lib/firestore';
import { compressLessonImage, uploadLessonImage, validateImageFile } from '../lib/storage';
import { formatDateTime, toDate } from '../utils/format';
import { getDifficultyLabel } from '../utils/difficulty';
import { resolveRegisteredMonthFields } from '../utils/registeredMonth';
import { hasLessonImage } from '../utils/lessons';
import MissingLessonsFilters from '../components/MissingLessonsFilters';

const mapUploadError = (message = '') => {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('supported image formats')) return 'Supported formats: jpg, jpeg, png, webp.';
  if (normalized.includes('1mb')) return 'Compressed image must be 1MB or less.';
  if (normalized.includes('process image') || normalized.includes('load image')) return 'Failed to process image.';
  return 'Failed to upload image.';
};

const getSortTime = (lesson) => {
  const createdAt = toDate(lesson?.createdAt);
  if (createdAt && !Number.isNaN(createdAt.getTime())) return createdAt.getTime();
  const updatedAt = toDate(lesson?.updatedAt);
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) return updatedAt.getTime();
  return 0;
};

export default function MissingPhotoLessonsPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingIds, setUploadingIds] = useState({});
  const [lessonErrors, setLessonErrors] = useState({});
  const [uploadedIds, setUploadedIds] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  useEffect(() => {
    const loadLessons = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(userId),
          ensureInitialCategories(userId),
        ]);
        setLessons(fetchedLessons);
        setCategories(fetchedCategories);
      } catch {
        setLessons([]);
        setCategories([]);
        setError('Failed to load lessons.');
      } finally {
        setIsLoading(false);
      }
    };

    loadLessons();
  }, []);

  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const missingPhotoLessons = useMemo(
    () => lessons
      .filter((lesson) => !hasLessonImage(lesson) && !uploadedIds[lesson.id])
      .sort((a, b) => {
        const monthDiff = String(b.registeredMonth || '').localeCompare(String(a.registeredMonth || ''));
        if (monthDiff !== 0) return monthDiff;
        return getSortTime(b) - getSortTime(a);
      }),
    [lessons, uploadedIds],
  );

  const availableMonths = useMemo(() => {
    const monthMap = new Map();
    missingPhotoLessons.forEach((lesson) => {
      const monthFields = resolveRegisteredMonthFields(lesson);
      const monthKey = monthFields.registeredMonth || '';
      if (monthKey) monthMap.set(monthKey, monthFields.registeredMonthLabel || monthKey);
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .map(([value, label]) => ({ value, label }));
  }, [missingPhotoLessons]);

  const filteredLessons = useMemo(() => {
    return missingPhotoLessons.filter((lesson) => {
      if (categoryFilter !== 'all' && (lesson.categoryId || '__unset__') !== categoryFilter) return false;
      if (difficultyFilter !== 'all' && (lesson.difficulty || 'easy') !== difficultyFilter) return false;
      if (monthFilter !== 'all') {
        const monthFields = resolveRegisteredMonthFields(lesson);
        if ((monthFields.registeredMonth || '') !== monthFilter) return false;
      }
      return true;
    });
  }, [missingPhotoLessons, categoryFilter, difficultyFilter, monthFilter]);

  const onFileChange = (lessonId, file) => {
    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [lessonId]: null }));
      setLessonErrors((prev) => ({ ...prev, [lessonId]: '' }));
      return;
    }

    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      setSelectedFiles((prev) => ({ ...prev, [lessonId]: null }));
      setLessonErrors((prev) => ({ ...prev, [lessonId]: mapUploadError(validationMessage) }));
      return;
    }

    setSelectedFiles((prev) => ({ ...prev, [lessonId]: file }));
    setLessonErrors((prev) => ({ ...prev, [lessonId]: '' }));
  };

  const onUpload = async (lessonId) => {
    const file = selectedFiles[lessonId];
    if (!file) {
      setLessonErrors((prev) => ({ ...prev, [lessonId]: 'Please select an image file first.' }));
      return;
    }

    setUploadingIds((prev) => ({ ...prev, [lessonId]: true }));
    setLessonErrors((prev) => ({ ...prev, [lessonId]: '' }));

    try {
      const compressed = await compressLessonImage({ file });
      const uploaded = await uploadLessonImage({ file: compressed, lessonId, userId });
      await updateLessonImage(lessonId, {
        imagePath: uploaded.imagePath,
        imageUrl: uploaded.imageUrl,
      });

      setUploadedIds((prev) => ({ ...prev, [lessonId]: true }));
      setSelectedFiles((prev) => ({ ...prev, [lessonId]: null }));
      window.setTimeout(() => {
        setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
      }, 700);
    } catch (uploadError) {
      const message = uploadError?.message ? mapUploadError(uploadError.message) : 'Failed to upload image.';
      setLessonErrors((prev) => ({ ...prev, [lessonId]: message }));
    } finally {
      setUploadingIds((prev) => ({ ...prev, [lessonId]: false }));
    }
  };

  return (
    <section className="stack">
      <div className="row between">
        <div>
          <p className="section-subtle">Lesson Management</p>
          <h2 className="section-title">Missing Photo</h2>
          {!isLoading ? <p className="section-subtle">Missing photo: {filteredLessons.length} lessons</p> : null}
        </div>
        <Link className="btn ghost" to="/lessons">Back to Lessons</Link>
      </div>

      {error ? <article className="card error">{error}</article> : null}

      {!isLoading && !error ? (
        <MissingLessonsFilters
          availableMonths={availableMonths}
          categories={categories}
          categoryFilter={categoryFilter}
          difficultyFilter={difficultyFilter}
          monthFilter={monthFilter}
          onCategoryChange={setCategoryFilter}
          onDifficultyChange={setDifficultyFilter}
          onMonthChange={setMonthFilter}
        />
      ) : null}

      {isLoading ? <article className="card section-subtle">Loading lessons...</article> : null}

      {!isLoading && !error && filteredLessons.length === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">No lessons missing photo.</h3>
          <p className="section-subtle">All filtered lessons have images.</p>
          <div className="row gap-sm wrap center">
            <Link className="btn ghost" to="/lessons">Lessons</Link>
            <Link className="btn" to="/lessons/new">Add Lesson</Link>
          </div>
        </article>
      ) : null}

      {!isLoading && !error
        ? filteredLessons.map((lesson) => {
            const monthFields = resolveRegisteredMonthFields(lesson);
            const categoryName = categoryNameById.get(lesson.categoryId) || 'Not set';
            const isUploading = !!uploadingIds[lesson.id];
            const selectedFile = selectedFiles[lesson.id];
            const cardError = lessonErrors[lesson.id] || '';
            const uploaded = !!uploadedIds[lesson.id];
            const scriptPreview = String(lesson.scriptEn || '').trim();
            const updatedAtLabel = lesson.updatedAt ? formatDateTime(lesson.updatedAt) : formatDateTime(lesson.createdAt);

            return (
              <article className="card missing-photo-card" key={lesson.id}>
                <div className="row between missing-audio-card-head">
                  <h3 className="section-title">{lesson.title || 'Untitled lesson'}</h3>
                  <span className="pill">{getDifficultyLabel(lesson.difficulty)}</span>
                </div>
                <p className="section-subtle">Category: {categoryName}</p>
                <p className="section-subtle">Month: {monthFields.registeredMonthLabel || monthFields.registeredMonth || '-'}</p>
                <p className="missing-audio-script">{scriptPreview || '-'}</p>
                <p className="section-subtle">Updated: {updatedAtLabel}</p>
                <p className="section-subtle missing-photo-badge">Photo: Missing</p>

                <div className="missing-audio-actions">
                  <input
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    disabled={isUploading}
                    type="file"
                    onChange={(event) => onFileChange(lesson.id, event.target.files?.[0] || null)}
                  />
                  <div className="row gap-sm wrap">
                    <button disabled={isUploading || !selectedFile} type="button" onClick={() => onUpload(lesson.id)}>
                      {isUploading ? 'Uploading...' : 'Upload Photo'}
                    </button>
                    <Link className="btn ghost" to={`/lessons/${lesson.id}/edit`}>Edit</Link>
                    {uploaded ? <span className="section-subtle uploaded-label">Uploaded</span> : null}
                  </div>
                </div>

                {cardError ? <p className="error">{cardError}</p> : null}
              </article>
            );
          })
        : null}
    </section>
  );
}
