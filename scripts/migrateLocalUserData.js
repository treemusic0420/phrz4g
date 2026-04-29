#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_COLLECTIONS = ['lessons', 'categories', 'studyLogs', 'dictationAttempts', 'monthlyStats'];
const SOURCE_USER_ID = 'local';

const parseArgs = (argv) => {
  const args = { uid: '', dryRun: false };
  for (const token of argv) {
    if (token === '--dry-run') args.dryRun = true;
    if (token.startsWith('--uid=')) args.uid = token.slice(6).trim();
  }
  return args;
};

const loadServiceAccountFromEnv = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const maybeB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT_PHRZ4G;
  if (maybeB64) return JSON.parse(Buffer.from(maybeB64, 'base64').toString('utf8'));
  const fromPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (fromPath) return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), fromPath), 'utf8'));
  return null;
};

const replaceLocalPrefix = (v, uid) => (typeof v === 'string' && v.startsWith('users/local/') ? v.replace('users/local/', `users/${uid}/`) : '');

async function main() {
  const { uid, dryRun } = parseArgs(process.argv.slice(2));
  if (!uid) throw new Error('Missing --uid=...');
  if (uid === SOURCE_USER_ID) throw new Error('uid must not be local');

  let admin;
  try { admin = await import('firebase-admin'); } catch { throw new Error('Missing firebase-admin package.'); }

  const serviceAccount = loadServiceAccountFromEnv();
  admin.initializeApp(serviceAccount ? { credential: admin.credential.cert(serviceAccount), storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : { storageBucket: process.env.FIREBASE_STORAGE_BUCKET });

  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const counters = { firestoreTargets: 0, firestoreUpdated: 0, firestorePlanned: 0, lessonUpdated: 0, lessonPlanned: 0, storageTargets: 0, storageCopied: 0, storagePlanned: 0, skipped: 0, errors: 0 };

  console.log(`[migrate:local] target UID: ${uid}`);
  console.log(`[migrate:local] dry-run: ${dryRun}`);

  const snaps = {};
  for (const name of DEFAULT_COLLECTIONS) {
    const snap = await db.collection(name).where('userId', '==', SOURCE_USER_ID).get();
    snaps[name] = snap;
    counters.firestoreTargets += snap.size;
    console.log(`[scan] ${name}: ${snap.size}`);
  }

  const backupCollection = `migrationBackups_local_to_${uid}_${Date.now()}`;
  if (!dryRun) {
    for (const [name, snap] of Object.entries(snaps)) {
      for (const doc of snap.docs) {
        await db.collection(backupCollection).doc(`${name}_${doc.id}`).set({ sourceCollection: name, sourceDocId: doc.id, data: doc.data(), migratedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }

  for (const [name, snap] of Object.entries(snaps)) {
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const patch = { userId: uid };
      if (name === 'lessons') {
        const audioPath = replaceLocalPrefix(data.audioPath, uid);
        const imagePath = replaceLocalPrefix(data.imagePath, uid);
        if (audioPath) patch.audioPath = audioPath;
        if (imagePath) patch.imagePath = imagePath;

        if (!dryRun) {
          if (audioPath && data.audioUrl) patch.audioUrl = await bucket.file(audioPath).getSignedUrl({ action: 'read', expires: '03-01-2500' }).then((x) => x[0]).catch(() => data.audioUrl || '');
          if (imagePath && data.imageUrl) patch.imageUrl = await bucket.file(imagePath).getSignedUrl({ action: 'read', expires: '03-01-2500' }).then((x) => x[0]).catch(() => data.imageUrl || '');
        }
      }

      if (dryRun) {
        counters.firestorePlanned += 1;
        if (name === 'lessons') counters.lessonPlanned += 1;
      } else {
        await doc.ref.update(patch);
        counters.firestoreUpdated += 1;
        if (name === 'lessons') counters.lessonUpdated += 1;
      }
    }
  }

  const copyPrefix = async (fromPrefix, toPrefix) => {
    const [files] = await bucket.getFiles({ prefix: fromPrefix });
    for (const file of files) {
      if (!file.name || file.name.endsWith('/')) continue;
      counters.storageTargets += 1;
      const relative = file.name.slice(fromPrefix.length);
      const dest = bucket.file(`${toPrefix}${relative}`);
      if ((await dest.exists())[0]) { counters.skipped += 1; continue; }
      if (dryRun) counters.storagePlanned += 1;
      else { await file.copy(dest); counters.storageCopied += 1; }
    }
  };

  await copyPrefix('users/local/lesson-audio/', `users/${uid}/lesson-audio/`);
  await copyPrefix('users/local/lesson-images/', `users/${uid}/lesson-images/`);

  console.log('--- Summary ---');
  console.log(`移行先UID: ${uid}`);
  console.log(`対象Firestore件数: ${counters.firestoreTargets}`);
  console.log(`Storageコピー対象件数: ${counters.storageTargets}`);
  console.log(`更新したlesson件数: ${dryRun ? counters.lessonPlanned : counters.lessonUpdated}`);
  console.log(`スキップ件数: ${counters.skipped}`);
  console.log(`エラー件数: ${counters.errors}`);
}

main().catch((e) => { console.error('[migrate:local] failed:', e.message); process.exit(1); });
