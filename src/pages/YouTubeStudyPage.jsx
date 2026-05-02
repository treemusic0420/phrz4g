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

const MAX_RESULTS = 10;

export default function YouTubeStudyPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [audioFile, setAudioFile] = useState(null);

  const [recentLessons, setRecentLessons] = useState([]);

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

  const handleSearch = async () => {
    if (!apiKey) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchError('Please enter a search keyword.');
      setResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError('');

    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS}&q=${encodeURIComponent(trimmed)}&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Failed to search YouTube videos.');
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setResults(items);
      if (items.length === 0) {
        setSearchError('No videos found.');
        setSelectedVideo(null);
      } else if (!selectedVideo) {
        setSelectedVideo(items[0]);
      }
    } catch (error) {
      setSearchError(error?.message || 'Failed to search YouTube videos.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
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
    <section className="card stack">
      <h2 className="section-title">YouTube Study</h2>

      {!apiKey ? <p className="error">YouTube API key is not configured.</p> : null}

      <div className="stack">
        <label>
          YouTube Keyword
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos..." />
        </label>
        <div className="row gap-sm wrap">
          <button disabled={!apiKey || isSearching} onClick={handleSearch} type="button">
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchError ? <p className="error">{searchError}</p> : null}
      </div>

      <div className="youtube-study-grid">
        <div className="stack">
          <h3 className="section-subtitle">Results</h3>
          <div className="youtube-results">
            {results.map((item) => {
              const videoId = item?.id?.videoId;
              const snippet = item?.snippet || {};
              const thumb = snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url;
              return (
                <button
                  key={videoId}
                  className={`youtube-result-item ${selectedVideo?.id?.videoId === videoId ? 'active' : ''}`}
                  onClick={() => setSelectedVideo(item)}
                  type="button"
                >
                  {thumb ? <img alt={snippet?.title || 'thumbnail'} src={thumb} /> : null}
                  <div>
                    <p className="youtube-result-title">{snippet?.title}</p>
                    <p className="section-subtle">{snippet?.channelTitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="stack">
          <h3 className="section-subtitle">Player</h3>
          {selectedVideo?.id?.videoId ? (
            <div className="youtube-player-wrap">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                src={`https://www.youtube.com/embed/${selectedVideo.id.videoId}`}
                title={selectedVideo?.snippet?.title || 'YouTube player'}
              />
            </div>
          ) : (
            <p className="section-subtle">Select a video to play.</p>
          )}
        </div>
      </div>

      <form className="stack" onSubmit={handleAddLesson}>
        <h3 className="section-subtitle">Add Lesson</h3>
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

      <div className="stack">
        <h3 className="section-subtitle">Added in this screen</h3>
        {recentLessons.length === 0 ? <p className="section-subtle">No lessons yet.</p> : null}
        <div className="stack">
          {recentLessons.map((lesson) => (
            <article key={lesson.id} className="card lesson-list-item">
              <h4>{lesson.title}</h4>
              <p className="section-subtle">{lesson.scriptEn}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
