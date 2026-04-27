import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const inferAudioContentTypeByPath = (audioPath = '') => {
  const ext = audioPath.split('.').pop()?.toLowerCase();
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  return '';
};

const mapLesson = (snap) => {
  const data = snap.data();
  const inferredContentType = inferAudioContentTypeByPath(data.audioPath || '');
  return {
    id: snap.id,
    userId: data.userId,
    title: data.title || '',
    category: data.category || '',
    scriptEn: data.scriptEn || '',
    scriptJa: data.scriptJa || '',
    audioUrl: data.audioUrl || '',
    audioPath: data.audioPath || '',
    audioContentType: data.audioContentType || inferredContentType,
    difficulty: data.difficulty || '未設定',
    memo: data.memo || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    lastStudiedAt: data.lastStudiedAt || null,
    dictationCount: data.dictationCount || 0,
    shadowingCount: data.shadowingCount || 0,
    totalStudySeconds: data.totalStudySeconds || 0,
  };
};

export const fetchLessons = async (userId) => {
  const q = query(collection(db, 'lessons'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(mapLesson);
};

export const fetchLessonById = async (lessonId) => {
  const snap = await getDoc(doc(db, 'lessons', lessonId));
  if (!snap.exists()) return null;
  return mapLesson(snap);
};

export const createLesson = async (payload) => {
  const now = serverTimestamp();
  return addDoc(collection(db, 'lessons'), {
    ...payload,
    difficulty: payload.difficulty || '未設定',
    memo: payload.memo || '',
    dictationCount: 0,
    shadowingCount: 0,
    totalStudySeconds: 0,
    lastStudiedAt: null,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateLesson = async (lessonId, payload) => {
  return updateDoc(doc(db, 'lessons', lessonId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const updateLessonAudioUrl = async (lessonId, audioUrl) => {
  if (!lessonId || !audioUrl) return;
  return updateDoc(doc(db, 'lessons', lessonId), {
    audioUrl,
    updatedAt: serverTimestamp(),
  });
};

export const createStudyLog = async (payload) => {
  return addDoc(collection(db, 'studyLogs'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
};

export const createDictationAttempt = async (payload) => {
  return addDoc(collection(db, 'dictationAttempts'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
};

export const fetchStudyLogs = async (userId) => {
  const q = query(collection(db, 'studyLogs'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const updateLessonStats = async (lessonId, trainingType, durationSeconds) => {
  const lessonRef = doc(db, 'lessons', lessonId);
  const snap = await getDoc(lessonRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const dictationCount = data.dictationCount || 0;
  const shadowingCount = data.shadowingCount || 0;
  const totalStudySeconds = data.totalStudySeconds || 0;

  await updateDoc(lessonRef, {
    dictationCount: trainingType === 'dictation' ? dictationCount + 1 : dictationCount,
    shadowingCount: trainingType === 'shadowing' ? shadowingCount + 1 : shadowingCount,
    totalStudySeconds: totalStudySeconds + durationSeconds,
    lastStudiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const deleteLessonDoc = async (lessonId) => deleteDoc(doc(db, 'lessons', lessonId));
