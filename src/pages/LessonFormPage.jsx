import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createLesson, deleteLessonDoc, ensureInitialCategories, fetchLessonById, updateLesson } from '../lib/firestore';
import {
  deleteAudioByPath,
  deleteImageByPath,
  compressLessonImage,
  getAudioContentTypeFromExtension,
  getFileExtension,
  uploadLessonAudio,
  uploadLessonImage,
  validateAudioFile,
  validateImageFile,
} from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { sortCategories } from '../utils/lessons';
import { DIFFICULTY_OPTIONS, normalizeDifficulty } from '../utils/difficulty';

const defaultForm = {
  title: '',
  categoryId: '',
  scriptEn: '',
  scriptJa: '',
  difficulty: 'easy',
  memo: '',
  audioUrl: '',
  audioPath: '',
  audioContentType: '',
  imageUrl: '',
  imagePath: '',
};

const MP3_ONLY_ERROR = 'Only MP3 files are currently supported. Convert m4a files to MP3 before uploading.';

export default function LessonFormPage({ mode }) {
  const { user } = useAuth();
  const userId = user?.uid || ''; 
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState(defaultForm);
  const [categories, setCategories] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [audioDebugInfo, setAudioDebugInfo] = useState({ ext: '', contentType: '' });
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  useEffect(
    () => () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    },
    [imagePreviewUrl],
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingCategories(true);
      setError('');
      const loadedCategories = sortCategories(await ensureInitialCategories(userId));
      const activeCategories = loadedCategories.filter((category) => category.isActive);
      setCategories(activeCategories);

      if (mode !== 'edit' || !id) {
        if (activeCategories.length > 0) {
          setForm((prev) => (prev.categoryId ? prev : { ...prev, categoryId: activeCategories[0].id }));
        }
        setIsLoadingCategories(false);
        return;
      }

      const lesson = await fetchLessonById(id);
      if (!lesson) {
        setIsLoadingCategories(false);
        return;
      }
      if (lesson.userId !== userId) {
        setIsLoadingCategories(false);
        return navigate('/lessons');
      }

      const categoryExists = activeCategories.some((category) => category.id === lesson.categoryId);
      const fallbackCategoryId = categoryExists ? lesson.categoryId : activeCategories[0]?.id || '';

      setForm((prev) => ({
        ...prev,
        ...lesson,
        difficulty: normalizeDifficulty(lesson.difficulty),
        categoryId: fallbackCategoryId,
      }));

      if (lesson.categoryId && !categoryExists && activeCategories.length > 0) {
        setError('The previous category no longer exists. Please review and save again.');
      }
      const ext = getFileExtension(lesson.audioPath || '');
      const contentType = lesson.audioContentType || getAudioContentTypeFromExtension(ext) || '';
      setAudioDebugInfo({ ext, contentType });
      setIsLoadingCategories(false);
    };

    loadData()
      .catch((err) => setError(err?.message || 'Failed to load initial data.'))
      .finally(() => setIsLoadingCategories(false));
  }, [id, mode, navigate]);

  const categoryOptions = useMemo(() => sortCategories(categories), [categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let audioUrl = form.audioUrl || '';
      let audioPath = form.audioPath || '';
      let audioContentType = form.audioContentType || getAudioContentTypeFromExtension(getFileExtension(form.audioPath));
      let imageUrl = form.imageUrl || '';
      let imagePath = form.imagePath || '';
      if (audioFile) {
        const message = validateAudioFile(audioFile);
        if (message) throw new Error(message);
        const uploaded = await uploadLessonAudio({ file: audioFile, userId });
        audioUrl = uploaded.audioUrl;
        audioPath = uploaded.audioPath;
        audioContentType = uploaded.audioContentType;
        if (mode === 'edit' && form.audioPath && form.audioPath !== uploaded.audioPath) {
          await deleteAudioByPath(form.audioPath).catch(() => {});
        }
      }

      let compressedImageFile = null;
      if (imageFile) {
        const imageMessage = validateImageFile(imageFile);
        if (imageMessage) throw new Error(imageMessage);
        compressedImageFile = await compressLessonImage({ file: imageFile });
      }

      const payload = {
        userId: userId,
        title: form.title,
        categoryId: form.categoryId,
        scriptEn: form.scriptEn,
        scriptJa: form.scriptJa,
        difficulty: normalizeDifficulty(form.difficulty),
        memo: form.memo || '',
        audioUrl,
        audioPath,
        audioContentType: audioContentType || '',
        imageUrl,
        imagePath,
      };

      if (!payload.title || !payload.scriptEn) throw new Error('Title and English Script are required.');
      if (!categoryOptions.length) throw new Error('No categories available. Please create a category first.');
      if (!payload.categoryId) throw new Error('Please select a category.');
      if (!form.difficulty) throw new Error('Please select a difficulty.');
      if (payload.audioPath || payload.audioUrl) {
        const savedExt = getFileExtension(payload.audioPath);
        if (savedExt !== 'mp3') throw new Error(MP3_ONLY_ERROR);
        payload.audioContentType = 'audio/mpeg';
      }

      if (mode === 'create') {
        const docRef = await createLesson(payload);
        if (compressedImageFile) {
          const uploadedImage = await uploadLessonImage({ file: compressedImageFile, lessonId: docRef.id, userId });
          await updateLesson(docRef.id, {
            ...payload,
            imageUrl: uploadedImage.imageUrl,
            imagePath: uploadedImage.imagePath,
          });
        }
        navigate(`/lessons/${docRef.id}`);
      } else {
        if (compressedImageFile) {
          const uploadedImage = await uploadLessonImage({ file: compressedImageFile, lessonId: id, userId });
          imageUrl = uploadedImage.imageUrl;
          imagePath = uploadedImage.imagePath;
          if (form.imagePath && form.imagePath !== uploadedImage.imagePath) {
            await deleteImageByPath(form.imagePath).catch(() => {});
          }
        }
        await updateLesson(id, { ...payload, imageUrl, imagePath });
        navigate(`/lessons/${id}`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (mode !== 'edit' || !id || isDeleting) return;
    setError('');

    const confirmed = window.confirm('Delete this lesson? This action cannot be undone.');
    if (!confirmed) return;

    if (form.userId && form.userId !== userId) {
      setError('This lesson cannot be deleted.');
      return;
    }

    setIsDeleting(true);
    try {
      if (form.audioPath) {
        await deleteAudioByPath(form.audioPath).catch((storageError) => {
          const code = storageError?.code || '';
          if (code.includes('object-not-found')) return;
        });
      }
      if (form.imagePath) {
        await deleteImageByPath(form.imagePath).catch((storageError) => {
          const code = storageError?.code || '';
          if (code.includes('object-not-found')) return;
        });
      }

      await deleteLessonDoc(id);

      if (form.categoryId && form.registeredMonth) {
        navigate(`/lessons/category/${form.categoryId}/month/${form.registeredMonth}`);
      } else {
        navigate('/lessons');
      }
    } catch (deleteError) {
      setError(`Failed to delete lesson: ${deleteError?.message || 'Unknown error'}`);
      setIsDeleting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">{mode === 'create' ? 'Add Lesson' : 'Edit Lesson'}</h2>
      <form className="stack" onSubmit={handleSubmit}>
        <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>
          Category
          <select
            required
            value={form.categoryId}
            disabled={isLoadingCategories || categoryOptions.length === 0}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            {isLoadingCategories ? <option value="">Loading categories...</option> : null}
            {!isLoadingCategories && categoryOptions.length === 0 ? (
              <option value="">No categories available</option>
            ) : null}
            {!isLoadingCategories
              ? categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))
              : null}
          </select>
          {!isLoadingCategories && categoryOptions.length === 0 ? (
            <p className="error">No categories available. Please create a category first.</p>
          ) : null}
        </label>
        <label>
          Difficulty
          <select
            required
            value={normalizeDifficulty(form.difficulty)}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>English Script<textarea required rows="4" value={form.scriptEn} onChange={(e) => setForm({ ...form, scriptEn: e.target.value })} /></label>
        <label>Translation<textarea rows="3" value={form.scriptJa} onChange={(e) => setForm({ ...form, scriptJa: e.target.value })} /></label>
        <label>Notes<textarea rows="3" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></label>
        <label>
          Lesson Image (optional, jpg/jpeg/png/webp, under 1MB after compression)
          <input
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            type="file"
            onChange={(e) => {
              const nextFile = e.target.files?.[0] || null;
              if (!nextFile) {
                setImageFile(null);
                setImagePreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return '';
                });
                setError('');
                return;
              }
              const message = validateImageFile(nextFile);
              if (message) {
                setImageFile(null);
                setImagePreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return '';
                });
                setError(message);
                return;
              }
              setImageFile(nextFile);
              const objectUrl = URL.createObjectURL(nextFile);
              setImagePreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return objectUrl;
              });
              setError('');
            }}
          />
        </label>
        {imagePreviewUrl || form.imageUrl ? (
          <img className="lesson-image-preview" src={imagePreviewUrl || form.imageUrl} alt="Lesson preview" />
        ) : null}
        <label>
          Audio File (optional, MP3, under 20MB)
          <input
            accept="audio/mpeg,.mp3"
            type="file"
            onChange={(e) => {
              const nextFile = e.target.files?.[0] || null;
              if (!nextFile) {
                setAudioFile(null);
                setError('');
                setAudioDebugInfo({ ext: '', contentType: '' });
                return;
              }
              const ext = getFileExtension(nextFile.name);
              const contentType = nextFile.type || '';
              setAudioDebugInfo({ ext, contentType });
              const message = validateAudioFile(nextFile);
              if (message) {
                setAudioFile(null);
                setError(message);
                return;
              }
              setError('');
              setAudioFile(nextFile);
            }}
          />
        </label>
        <p className="section-subtle">You can add a lesson without audio. Audio can be added later from the edit screen.</p>
        <details className="debug-panel">
          <summary>audio upload debug</summary>
          <p>extension: {audioDebugInfo.ext || '-'}</p>
          <p>detected contentType: {audioDebugInfo.contentType || '-'}</p>
        </details>
        {form.audioUrl ? <audio controls src={form.audioUrl} /> : null}
        {!form.audioUrl && !audioFile && mode === 'edit' ? (
          <p className="section-subtle">No audio file yet.<br />You can upload an MP3 file.</p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="row gap-sm wrap">
          <button disabled={isDeleting} type="submit">Save</button>
          <Link className="btn ghost" to={mode === 'create' ? '/lessons' : `/lessons/${id}`}>
            Cancel
          </Link>
        </div>
        {mode === 'edit' ? (
          <div className="danger-zone">
            <p className="section-subtle">Danger Zone</p>
            <button className="btn danger-ghost" disabled={isDeleting} onClick={handleDelete} type="button">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
