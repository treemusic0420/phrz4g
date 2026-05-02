import { useEffect, useMemo, useState } from 'react';
import { createLesson, ensureInitialCategories, fetchLessons } from '../lib/firestore';
import {
  getAudioContentTypeFromExtension,
  getFileExtension,
  uploadLessonAudio,
  validateAudioFile,
} from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { sortCategories } from '../utils/lessons';
import { DIFFICULTY_OPTIONS, normalizeDifficulty } from '../utils/difficulty';

const extractYouTubeVideoId = (value) => {
  if (!value) return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || '';
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        return url.searchParams.get('v') || '';
      }

      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/').filter(Boolean)[1] || '';
      }

      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/').filter(Boolean)[1] || '';
      }
    }
  } catch {
    return '';
  }

  return '';
};

export default function YouTubeStudyPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';

  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [videoLoadError, setVideoLoadError] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [audioFile, setAudioFile] = useState(null);

  const [recentLessons, setRecentLessons] = useState([]);
  const [isLessonPanelOpen, setIsLessonPanelOpen] = useState(false);

  const [form, setForm] = useState({
    title: '',
    scriptEn: '',
    scriptJa: '',
    memo: '',
    categoryId: '',
    difficulty: 'easy',
  });

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoadingCategories(true);
      try {
        const loadedCategories = sortCategories(await ensureInitialCategories(userId));
        const activeCategories = loadedCategories.filter((category) => category.isActive);
        setCategories(activeCategories);
        setForm((prev) => ({ ...prev, categoryId: prev.categoryId || activeCategories[0]?.id || '' }));

        const allLessons = await fetchLessons(userId);
        setRecentLessons(allLessons.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 10));
      } catch {
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadInitial();
  }, [userId]);

  const categoryOptions = useMemo(() => sortCategories(categories), [categories]);

  const handleLoadVideo = () => {
    const videoId = extractYouTubeVideoId(youtubeUrlInput);
    if (!videoId) {
      setVideoLoadError('Please enter a valid YouTube URL.');
      return;
    }

    setVideoLoadError('');
    setSelectedVideoId(videoId);
  };

  const handleAddLesson = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    setSaveError('');
    setSuccessMessage('');

    if (!form.title.trim() || !form.scriptEn.trim()) {
      setSaveError('Title and English Script are required.');
      return;
    }
    if (!form.categoryId) {
      setSaveError('Please select a category.');
      return;
    }

    setIsSaving(true);
    try {
      let audioUrl = '';
      let audioPath = '';
      let audioContentType = '';

      if (audioFile) {
        const message = validateAudioFile(audioFile);
        if (message) throw new Error(message);

        const uploaded = await uploadLessonAudio({ file: audioFile, userId });
        audioUrl = uploaded.audioUrl;
        audioPath = uploaded.audioPath;
        audioContentType = uploaded.audioContentType || getAudioContentTypeFromExtension(getFileExtension(audioPath)) || '';
      }

      const docRef = await createLesson({
        userId,
        title: form.title.trim(),
        categoryId: form.categoryId,
        scriptEn: form.scriptEn.trim(),
        scriptJa: form.scriptJa.trim(),
        difficulty: normalizeDifficulty(form.difficulty),
        memo: form.memo.trim(),
        audioUrl,
        audioPath,
        audioContentType,
        imagePath: '',
        imageUrl: '',
      });

      setRecentLessons((prev) => [
        {
          id: docRef.id,
          title: form.title.trim(),
          scriptEn: form.scriptEn.trim(),
          scriptJa: form.scriptJa.trim(),
          memo: form.memo.trim(),
        },
        ...prev,
      ].slice(0, 20));

      setForm((prev) => ({
        ...prev,
        title: '',
        scriptEn: '',
        scriptJa: '',
        memo: '',
      }));
      setAudioFile(null);
      setSuccessMessage('Lesson added.');
    } catch (error) {
      setSaveError(error?.message || 'Failed to add lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="card stack youtube-study-page">
      <h2 className="section-title">YouTube Study</h2>

      <div className="stack">
        <label>
          YouTube URL
          <input
            value={youtubeUrlInput}
            onChange={(e) => setYoutubeUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </label>
        <div className="row gap-sm wrap">
          <button onClick={handleLoadVideo} type="button">Load Video</button>
          <button
            aria-controls="lesson-panel"
            aria-expanded={isLessonPanelOpen}
            onClick={() => setIsLessonPanelOpen(true)}
            type="button"
          >
            Open Add Lesson
          </button>
        </div>
        {videoLoadError ? <p className="error">{videoLoadError}</p> : null}
        <div className="row gap-sm wrap">
          <a className="btn ghost" href="https://www.youtube.com/" rel="noreferrer" target="_blank">
            Open YouTube
          </a>
          <a className="btn ghost" href="https://www.youtube.com/@Atsueigo" rel="noreferrer" target="_blank">
            Open Atsueigo on YouTube
          </a>
        </div>
      </div>

      <div className="youtube-study-player-stack">
        {selectedVideoId ? (
          <div className="youtube-player-wrap">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              src={`https://www.youtube.com/embed/${selectedVideoId}`}
              title="YouTube player"
            />
          </div>
        ) : (
          <div className="youtube-player-placeholder" role="status">
            <p>Paste a YouTube video URL to start collecting phrases.</p>
          </div>
        )}
      </div>

      <div
        className={`youtube-lesson-panel-overlay${isLessonPanelOpen ? ' is-open' : ''}`}
        onClick={() => setIsLessonPanelOpen(false)}
      />
      <aside
        aria-hidden={!isLessonPanelOpen}
        className={`youtube-lesson-panel${isLessonPanelOpen ? ' is-open' : ''}`}
        id="lesson-panel"
      >
        <div className="youtube-lesson-panel-header">
          <h3 className="section-subtitle">Add Lesson</h3>
          <button onClick={() => setIsLessonPanelOpen(false)} type="button">Close</button>
        </div>
        <form className="stack" onSubmit={handleAddLesson}>
          <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>English Script<textarea required rows="4" value={form.scriptEn} onChange={(e) => setForm({ ...form, scriptEn: e.target.value })} /></label>
          <label>Translation<textarea rows="3" value={form.scriptJa} onChange={(e) => setForm({ ...form, scriptJa: e.target.value })} /></label>
          <label>
            Audio (optional, MP3)
            <input
              accept="audio/mpeg,.mp3"
              type="file"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null;
                if (!nextFile) {
                  setAudioFile(null);
                  return;
                }
                setAudioFile(nextFile);
              }}
            />
          </label>
          <label>
            Category
            <select
              required
              disabled={isLoadingCategories || categoryOptions.length === 0}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>Note<textarea rows="3" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></label>
          <div className="row gap-sm wrap">
            <button disabled={isSaving || isLoadingCategories || !categoryOptions.length} type="submit">
              {isSaving ? 'Adding...' : 'Add Lesson'}
            </button>
          </div>
          {saveError ? <p className="error">{saveError}</p> : null}
          {successMessage ? <p className="section-subtle">{successMessage}</p> : null}
        </form>

        <details className="youtube-lesson-panel-list" open>
          <summary>Added in this screen</summary>
          {recentLessons.length === 0 ? <p className="section-subtle">No lessons yet.</p> : null}
          <div className="stack">
            {recentLessons.map((lesson) => (
              <article key={lesson.id} className="card lesson-list-item">
                <h4>{lesson.title}</h4>
                <p className="section-subtle">{lesson.scriptEn}</p>
              </article>
            ))}
          </div>
        </details>
      </aside>
      <div className="youtube-lesson-panel-mobile-trigger">
        <button
          aria-controls="lesson-panel"
          aria-expanded={isLessonPanelOpen}
          onClick={() => setIsLessonPanelOpen(true)}
          type="button"
        >
          Add Lesson
        </button>
      </div>
    </section>
  );
}
