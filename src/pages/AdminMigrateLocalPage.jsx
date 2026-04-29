import { useMemo, useState } from 'react';
import { collection, doc, getCountFromServer, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const TARGET_UID = 'EpwjD8uFm2YNgqFB8SGPzMB5jfg1';
const COLLECTIONS = ['lessons', 'categories', 'studyLogs', 'dictationAttempts', 'monthlyStats'];

const replaceLocalPath = (value) => {
  if (!value || typeof value !== 'string') return '';
  if (!value.startsWith('users/local/')) return '';
  return value.replace('users/local/', `users/${TARGET_UID}/`);
};

export default function AdminMigrateLocalPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);

  const isAllowed = user?.uid === TARGET_UID;

  const pushLog = (message) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);

  const run = async ({ dryRun }) => {
    setRunning(true);
    setLogs([]);
    setSummary(null);
    const counters = { firestoreTargets: 0, lessonsUpdated: 0, docsUpdated: 0, storageCopied: 0, skipped: 0, errors: 0 };

    try {
      pushLog(`開始: ${dryRun ? 'Dry Run' : '本実行'} / target UID=${TARGET_UID}`);

      const existingTargetCounts = await Promise.all(
        COLLECTIONS.map(async (name) => {
          const countSnap = await getCountFromServer(query(collection(db, name), where('userId', '==', TARGET_UID)));
          return { name, count: countSnap.data().count || 0 };
        }),
      );
      const hasExisting = existingTargetCounts.some((x) => x.count > 0);
      if (hasExisting) {
        pushLog(`警告: 移行先UID(${TARGET_UID})に既存データがあります: ${existingTargetCounts.map((x) => `${x.name}=${x.count}`).join(', ')}`);
      }

      const snapshots = {};
      for (const colName of COLLECTIONS) {
        const snap = await getDocs(query(collection(db, colName), where('userId', '==', 'local')));
        snapshots[colName] = snap;
        counters.firestoreTargets += snap.size;
        pushLog(`[scan] ${colName}: ${snap.size}件`);
      }

      if (dryRun) {
        setSummary(counters);
        pushLog('Dry Run完了: 更新は実行していません。');
        return;
      }

      for (const docSnap of snapshots.lessons.docs) {
        const data = docSnap.data() || {};
        const patch = { userId: TARGET_UID };

        const audioPath = replaceLocalPath(data.audioPath);
        const imagePath = replaceLocalPath(data.imagePath);

        try {
          if (audioPath) {
            const sourceRef = ref(storage, data.audioPath);
            const sourceUrl = await getDownloadURL(sourceRef);
            const blob = await fetch(sourceUrl).then((res) => {
              if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
              return res.blob();
            });
            await uploadBytes(ref(storage, audioPath), blob, { contentType: data.audioContentType || blob.type || 'audio/mpeg' });
            patch.audioPath = audioPath;
            patch.audioUrl = await getDownloadURL(ref(storage, audioPath));
            counters.storageCopied += 1;
          }

          if (imagePath) {
            const sourceRef = ref(storage, data.imagePath);
            const sourceUrl = await getDownloadURL(sourceRef);
            const blob = await fetch(sourceUrl).then((res) => {
              if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
              return res.blob();
            });
            await uploadBytes(ref(storage, imagePath), blob, { contentType: blob.type || 'image/webp' });
            patch.imagePath = imagePath;
            patch.imageUrl = await getDownloadURL(ref(storage, imagePath));
            counters.storageCopied += 1;
          }
        } catch (error) {
          counters.errors += 1;
          pushLog(`[error] lesson ${docSnap.id} storage copy: ${error.message}`);
        }

        await updateDoc(doc(db, 'lessons', docSnap.id), patch);
        counters.lessonsUpdated += 1;
        counters.docsUpdated += 1;
      }

      for (const colName of COLLECTIONS.filter((name) => name !== 'lessons')) {
        for (const docSnap of snapshots[colName].docs) {
          await updateDoc(doc(db, colName, docSnap.id), { userId: TARGET_UID });
          counters.docsUpdated += 1;
        }
      }

      pushLog('本実行完了。users/local は削除していません。');
      setSummary(counters);
    } catch (error) {
      counters.errors += 1;
      pushLog(`[fatal] ${error.message}`);
      setSummary(counters);
    } finally {
      setRunning(false);
    }
  };

  const canRun = useMemo(() => !!user && isAllowed && !running, [user, isAllowed, running]);

  return (
    <section className="card admin-migrate-card">
      <h1>Admin: local データ移行</h1>
      <p>ログインUID: <code>{user?.uid || '-'}</code></p>
      <p>ログインemail: <code>{user?.email || '-'}</code></p>
      <p>移行先UID: <code>{TARGET_UID}</code></p>
      {!isAllowed ? <p className="error-text">この画面の実行権限は対象UID本人のみです。</p> : null}

      <div className="admin-migrate-actions">
        <button className="btn ghost" disabled={!canRun} onClick={() => run({ dryRun: true })} type="button">Dry Run</button>
        <button
          className="btn"
          disabled={!canRun}
          onClick={() => {
            if (window.confirm('本実行します。users/local は削除されません。続行しますか？')) run({ dryRun: false });
          }}
          type="button"
        >
          本実行
        </button>
      </div>

      {summary ? (
        <div className="admin-migrate-summary">
          <p>対象Firestore件数: {summary.firestoreTargets}</p>
          <p>更新doc件数: {summary.docsUpdated}</p>
          <p>更新lesson件数: {summary.lessonsUpdated}</p>
          <p>Storageコピー件数: {summary.storageCopied}</p>
          <p>スキップ件数: {summary.skipped}</p>
          <p>エラー件数: {summary.errors}</p>
        </div>
      ) : null}

      <pre className="admin-migrate-log">{logs.join('\n')}</pre>
    </section>
  );
}
