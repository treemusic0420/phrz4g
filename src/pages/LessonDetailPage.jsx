import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import { fetchLessonById, updateLessonAudioUrl } from '../lib/firestore';
import { LOCAL_USER_ID } from '../lib/auth';
import { getAudioDownloadUrlByPath } from '../lib/storage';
import { formatDateTime, formatSeconds } from '../utils/format';

const getExtFromPath = (path = '') => path.split('.').pop()?.toLowerCase() || '';
const inferTypeByExt = (ext) => {
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  return '';
};
const isUnsupportedAudioFormat = (ext, contentType = '') =>
  ext === 'm4a' || contentType === 'audio/mp4' || contentType === 'audio/x-m4a';

export default function LessonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState('');
  const [audioLoadStatus, setAudioLoadStatus] = useState('idle');
  const [audioErrorMessage, setAudioErrorMessage] = useState('');
  const fileExtension = getExtFromPath(lesson?.audioPath || '');
  const audioContentType = lesson?.audioContentType || inferTypeByExt(fileExtension);
  const unsupportedFormat = isUnsupportedAudioFormat(fileExtension, audioContentType);

  useEffect(() => {
    fetchLessonById(id).then((doc) => {
      if (!doc || doc.userId !== LOCAL_USER_ID) return navigate('/lessons');
      setLesson(doc);
    });
  }, [id, navigate, LOCAL_USER_ID]);

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;

    const resolveUrl = async () => {
      setAudioErrorMessage('');
      setAudioLoadStatus('idle');
      if (unsupportedFormat) {
        setResolvedAudioUrl('');
        return;
      }
      if (lesson.audioUrl) {
        setResolvedAudioUrl(lesson.audioUrl);
        return;
      }

      if (!lesson.audioPath) {
        setResolvedAudioUrl('');
        setAudioErrorMessage('音声URLがありません');
        return;
      }

      setAudioLoadStatus('loading');
      try {
        const url = await getAudioDownloadUrlByPath(lesson.audioPath);
        if (cancelled) return;
        setResolvedAudioUrl(url);
        await updateLessonAudioUrl(lesson.id, url).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        setResolvedAudioUrl('');
        setAudioLoadStatus('error');
        setAudioErrorMessage(err.message || 'audioPathからURLを取得できませんでした');
      }
    };

    resolveUrl();
    return () => {
      cancelled = true;
    };
  }, [lesson, unsupportedFormat]);

  if (!lesson) return <p>読み込み中...</p>;

  return (
    <section className="stack">
      <article className="card">
        <h2 className="section-title">{lesson.title}</h2>
        <p>カテゴリ: {lesson.category || '-'}</p>
        <p>難易度: {lesson.difficulty || '未設定'}</p>
        <p className="section-subtle">英文</p>
        <pre className="mono">{lesson.scriptEn}</pre>
        <p>日本語訳</p>
        <pre>{lesson.scriptJa || '-'}</pre>
        <p>メモ</p>
        <pre>{lesson.memo || '-'}</pre>
        {unsupportedFormat ? (
          <p className="error">この教材の音声は現在対応していない形式です。mp3で再登録してください。</p>
        ) : (
          <AudioControls
            audioUrl={resolvedAudioUrl}
            audioContentType={audioContentType}
            onStatusChange={setAudioLoadStatus}
            onErrorMessage={setAudioErrorMessage}
          />
        )}
        <details className="debug-panel">
          <summary>audio debug</summary>
          <p>audioPath: {lesson.audioPath ? 'あり' : 'なし'}</p>
          <p>audioUrl: {lesson.audioUrl ? 'あり' : 'なし'}</p>
          <p>resolvedAudioUrl: {resolvedAudioUrl ? 'あり' : 'なし'}</p>
          <p>audioContentType: {audioContentType || '-'}</p>
          <p>file extension: {fileExtension || '-'}</p>
          <p>audio load status: {audioLoadStatus}</p>
          <p>audio error message: {audioErrorMessage || '-'}</p>
        </details>
        <p className="section-subtle">現在はmp3ファイルのみ対応しています。</p>
        <h3>学習概要</h3>
        <p>最終学習日: {formatDateTime(lesson.lastStudiedAt)}</p>
        <p>ディクテーション回数: {lesson.dictationCount || 0}</p>
        <p>シャドーイング回数: {lesson.shadowingCount || 0}</p>
        <p>累計学習時間: {formatSeconds(lesson.totalStudySeconds || 0)}</p>
      </article>
      <div className="row gap-sm wrap">
        <Link className="btn" to={`/lessons/${id}/dictation`}>ディクテーション</Link>
        <Link className="btn" to={`/lessons/${id}/shadowing`}>シャドーイング</Link>
        <Link className="btn ghost" to={`/lessons/${id}/edit`}>編集</Link>
      </div>
    </section>
  );
}
