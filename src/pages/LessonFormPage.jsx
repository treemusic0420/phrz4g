import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createLesson, fetchLessonById, updateLesson } from '../lib/firestore';
import {
  deleteAudioByPath,
  getAudioContentTypeFromExtension,
  getFileExtension,
  uploadLessonAudio,
  validateAudioFile,
} from '../lib/storage';
import { LOCAL_USER_ID } from '../lib/auth';

const defaultForm = {
  title: '',
  category: '',
  scriptEn: '',
  scriptJa: '',
  difficulty: '未設定',
  memo: '',
  audioUrl: '',
  audioPath: '',
  audioContentType: '',
};

const MP3_ONLY_ERROR = '現在はmp3ファイルのみ登録できます。m4a等はmp3に変換してから登録してください。';

export default function LessonFormPage({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState(defaultForm);
  const [audioFile, setAudioFile] = useState(null);
  const [audioDebugInfo, setAudioDebugInfo] = useState({ ext: '', contentType: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    fetchLessonById(id).then((lesson) => {
      if (!lesson) return;
      if (lesson.userId !== LOCAL_USER_ID) return navigate('/lessons');
      setForm((prev) => ({ ...prev, ...lesson }));
      const ext = getFileExtension(lesson.audioPath || '');
      const contentType = lesson.audioContentType || getAudioContentTypeFromExtension(ext) || '';
      setAudioDebugInfo({ ext, contentType });
    });
  }, [id, mode, navigate, LOCAL_USER_ID]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let audioUrl = form.audioUrl || '';
      let audioPath = form.audioPath || '';
      let audioContentType = form.audioContentType || getAudioContentTypeFromExtension(getFileExtension(form.audioPath));
      if (audioFile) {
        const message = validateAudioFile(audioFile);
        if (message) throw new Error(message);
        const uploaded = await uploadLessonAudio({ file: audioFile });
        audioUrl = uploaded.audioUrl;
        audioPath = uploaded.audioPath;
        audioContentType = uploaded.audioContentType;
        if (mode === 'edit' && form.audioPath && form.audioPath !== uploaded.audioPath) {
          await deleteAudioByPath(form.audioPath).catch(() => {});
        }
      }

      const payload = {
        userId: LOCAL_USER_ID,
        title: form.title,
        category: form.category,
        scriptEn: form.scriptEn,
        scriptJa: form.scriptJa,
        difficulty: form.difficulty || '未設定',
        memo: form.memo || '',
        audioUrl,
        audioPath,
        audioContentType: audioContentType || '',
      };

      if (!payload.title || !payload.scriptEn) throw new Error('タイトルと英文スクリプトは必須です。');
      if (!payload.audioUrl || !payload.audioPath) throw new Error('音声ファイルを登録してください。');
      const savedExt = getFileExtension(payload.audioPath);
      if (savedExt !== 'mp3') throw new Error(MP3_ONLY_ERROR);
      payload.audioContentType = 'audio/mpeg';

      if (mode === 'create') {
        const docRef = await createLesson(payload);
        navigate(`/lessons/${docRef.id}`);
      } else {
        await updateLesson(id, payload);
        navigate(`/lessons/${id}`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">{mode === 'create' ? '教材登録' : '教材編集'}</h2>
      <form className="stack" onSubmit={handleSubmit}>
        <label>タイトル<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>カテゴリ<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
        <label>難易度<input value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} /></label>
        <label>英文スクリプト<textarea required rows="4" value={form.scriptEn} onChange={(e) => setForm({ ...form, scriptEn: e.target.value })} /></label>
        <label>日本語訳<textarea rows="3" value={form.scriptJa} onChange={(e) => setForm({ ...form, scriptJa: e.target.value })} /></label>
        <label>メモ<textarea rows="3" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></label>
        <label>
          音声ファイル（mp3, 20MB未満）
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
        <p className="section-subtle">現在はmp3ファイルのみ登録できます。</p>
        <details className="debug-panel">
          <summary>audio upload debug</summary>
          <p>extension: {audioDebugInfo.ext || '-'}</p>
          <p>detected contentType: {audioDebugInfo.contentType || '-'}</p>
        </details>
        {form.audioUrl ? <audio controls src={form.audioUrl} /> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="row gap-sm wrap">
          <button type="submit">保存</button>
          <Link className="btn ghost" to={mode === 'create' ? '/lessons' : `/lessons/${id}`}>
            キャンセル
          </Link>
        </div>
      </form>
    </section>
  );
}
