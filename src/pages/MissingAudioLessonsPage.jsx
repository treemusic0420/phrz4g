import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { ensureInitialCategories, fetchLessons, updateLessonAudio } from '../lib/firestore';
import { uploadLessonAudio, validateAudioFile } from '../lib/storage';
import { formatDateTime, toDate } from '../utils/format';
import { getDifficultyLabel } from '../utils/difficulty';
import { resolveRegisteredMonthFields } from '../utils/registeredMonth';
import { hasLessonAudio } from '../utils/lessons';

const mapUploadError = (message = '') => {
  if (message.includes('20MB')) return 'Audio file must be under 20MB.';
  if (message.toLowerCase().includes('mp3')) return 'Only MP3 files are supported.';
  return 'Failed to upload audio.';
};

const getSortTime = (lesson) => {
  const createdAt = toDate(lesson?.createdAt);
  if (createdAt && !Number.isNaN(createdAt.getTime())) return createdAt.getTime();
  const updatedAt = toDate(lesson?.updatedAt);
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) return updatedAt.getTime();
  return 0;
};

export default function MissingAudioLessonsPage() {
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingIds, setUploadingIds] = useState({});
  const [lessonErrors, setLessonErrors] = useState({});
  const [uploadedIds, setUploadedIds] = useState({});

  useEffect(() => {
    const loadLessons = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [fetchedLessons, fetchedCategories] = await Promise.all([
          fetchLessons(LOCAL_USER_ID),
          ensureInitialCategories(LOCAL_USER_ID),
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

  const missingAudioLessons = useMemo(
    () => lessons
      .filter((lesson) => !hasLessonAudio(lesson) && !uploadedIds[lesson.id])
      .sort((a, b) => {
        const monthDiff = String(b.registeredMonth || '').localeCompare(String(a.registeredMonth || ''));
        if (monthDiff !== 0) return monthDiff;
        return getSortTime(b) - getSortTime(a);
      }),
    [lessons, uploadedIds],
  );

  const onFileChange = (lessonId, file) => {
    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [lessonId]: null }));
      setLessonErrors((prev) => ({ ...prev, [lessonId]: '' }));
      return;
    }

    const validationMessage = validateAudioFile(file);
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
      setLessonErrors((prev) => ({ ...prev, [lessonId]: 'Failed to upload audio.' }));
      return;
    }

    setUploadingIds((prev) => ({ ...prev, [lessonId]: true }));
    setLessonErrors((prev) => ({ ...prev, [lessonId]: '' }));

    try {
      const uploaded = await uploadLessonAudio({ file });
      await updateLessonAudio(lessonId, {
        audioPath: uploaded.audioPath,
        audioUrl: uploaded.audioUrl,
        audioContentType: uploaded.audioContentType,
      });

      setUploadedIds((prev) => ({ ...prev, [lessonId]: true }));
      setSelectedFiles((prev) => ({ ...prev, [lessonId]: null }));
      window.setTimeout(() => {
        setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
      }, 700);
    } catch (uploadError) {
      const message = uploadError?.message ? mapUploadError(uploadError.message) : 'Failed to upload audio.';
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
          <h2 className="section-title">Audio Missing Lessons</h2>
          {!isLoading ? <p className="section-subtle">Missing audio: {missingAudioLessons.length} lessons</p> : null}
        </div>
        <Link className="btn ghost" to="/lessons">Back to Lessons</Link>
      </div>

      {error ? <article className="card error">{error}</article> : null}

      {isLoading ? <article className="card section-subtle">Loading lessons...</article> : null}

      {!isLoading && !error && missingAudioLessons.length === 0 ? (
        <article className="card empty-state">
          <h3 className="section-title">All lessons have audio.</h3>
          <p className="section-subtle">Nice work. There are no lessons missing audio.</p>
          <div className="row gap-sm wrap center">
            <Link className="btn ghost" to="/lessons">Lessons</Link>
            <Link className="btn" to="/lessons/new">Add Lesson</Link>
          </div>
        </article>
      ) : null}

      {!isLoading && !error
        ? missingAudioLessons.map((lesson) => {
            const monthFields = resolveRegisteredMonthFields(lesson);
            const categoryName = categoryNameById.get(lesson.categoryId) || 'Not set';
            const isUploading = !!uploadingIds[lesson.id];
            const selectedFile = selectedFiles[lesson.id];
            const cardError = lessonErrors[lesson.id] || '';
            const uploaded = !!uploadedIds[lesson.id];
            const scriptPreview = String(lesson.scriptEn || '').trim();
            const updatedAtLabel = lesson.updatedAt ? formatDateTime(lesson.updatedAt) : formatDateTime(lesson.createdAt);

            return (
              <article className="card missing-audio-card" key={lesson.id}>
                <div className="row between missing-audio-card-head">
                  <h3 className="section-title">{lesson.title || 'Untitled lesson'}</h3>
                  <span className="pill">{getDifficultyLabel(lesson.difficulty)}</span>
                </div>
                <p className="section-subtle">Category: {categoryName}</p>
                <p className="section-subtle">Month: {monthFields.registeredMonthLabel || monthFields.registeredMonth || '-'}</p>
                <p className="missing-audio-script">{scriptPreview || '-'}</p>
                {lesson.scriptJa ? <p className="section-subtle">JA: {lesson.scriptJa}</p> : null}
                <p className="section-subtle">Updated: {updatedAtLabel}</p>

                <div className="missing-audio-actions">
                  <input
                    accept="audio/mpeg,.mp3"
                    disabled={isUploading}
                    type="file"
                    onChange={(event) => onFileChange(lesson.id, event.target.files?.[0] || null)}
                  />
                  <div className="row gap-sm wrap">
                    <button disabled={isUploading || !selectedFile} type="button" onClick={() => onUpload(lesson.id)}>
                      {isUploading ? 'Uploading...' : 'Upload MP3'}
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
