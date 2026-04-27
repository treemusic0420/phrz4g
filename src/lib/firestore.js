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
import { normalizeDifficulty } from '../utils/difficulty';
import { getRegisteredMonthFieldsFromDate, resolveRegisteredMonthFields } from '../utils/registeredMonth';

const DEFAULT_CATEGORIES = [
  { name: 'Kids', slug: 'kids', order: 10 },
  { name: 'Daily', slug: 'daily', order: 20 },
  { name: 'Business', slug: 'business', order: 30 },
  { name: 'Interview', slug: 'interview', order: 40 },
];

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
    categoryId: data.categoryId || '',
    scriptEn: data.scriptEn || '',
    scriptJa: data.scriptJa || '',
    audioUrl: data.audioUrl || '',
    audioPath: data.audioPath || '',
    audioContentType: data.audioContentType || inferredContentType,
    difficulty: normalizeDifficulty(data.difficulty),
    ...resolveRegisteredMonthFields({
      registeredMonth: data.registeredMonth,
      registeredMonthLabel: data.registeredMonthLabel,
      createdAt: data.createdAt,
    }),
    memo: data.memo || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    lastStudiedAt: data.lastStudiedAt || null,
    dictationCount: data.dictationCount || 0,
    shadowingCount: data.shadowingCount || 0,
    totalStudySeconds: data.totalStudySeconds || 0,
  };
};

const mapCategory = (snap) => {
  const data = snap.data();
  return {
    id: snap.id,
    userId: data.userId,
    name: data.name || '',
    slug: data.slug || '',
    order: Number(data.order) || 0,
    isActive: data.isActive !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
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
  const monthFields = getRegisteredMonthFieldsFromDate(new Date());
  return addDoc(collection(db, 'lessons'), {
    ...payload,
    categoryId: payload.categoryId || '',
    difficulty: normalizeDifficulty(payload.difficulty),
    ...monthFields,
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
  const lessonRef = doc(db, 'lessons', lessonId);
  const snap = await getDoc(lessonRef);
  const current = snap.exists() ? snap.data() : {};
  const monthFields = resolveRegisteredMonthFields({
    registeredMonth: current.registeredMonth || payload.registeredMonth,
    registeredMonthLabel: current.registeredMonthLabel || payload.registeredMonthLabel,
    createdAt: current.createdAt || payload.createdAt,
  });

  return updateDoc(lessonRef, {
    ...payload,
    categoryId: payload.categoryId || '',
    difficulty: normalizeDifficulty(payload.difficulty),
    ...monthFields,
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

export const fetchCategories = async (userId) => {
  const q = query(collection(db, 'categories'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(mapCategory);
};

export const ensureInitialCategories = async (userId) => {
  const current = await fetchCategories(userId);
  if (current.length > 0) return current;

  await Promise.all(
    DEFAULT_CATEGORIES.map((category) =>
      addDoc(collection(db, 'categories'), {
        userId,
        name: category.name,
        slug: category.slug,
        order: category.order,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  return fetchCategories(userId);
};

export const createCategory = async (payload) => {
  return addDoc(collection(db, 'categories'), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateCategory = async (categoryId, payload) => {
  return updateDoc(doc(db, 'categories', categoryId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const fetchCategoryById = async (categoryId) => {
  const snap = await getDoc(doc(db, 'categories', categoryId));
  if (!snap.exists()) return null;
  return mapCategory(snap);
};

export const deleteCategory = async (categoryId) => deleteDoc(doc(db, 'categories', categoryId));
