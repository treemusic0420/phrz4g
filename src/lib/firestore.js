import {
  addDoc,
  Timestamp,
  writeBatch,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
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
    imageUrl: data.imageUrl || '',
    imagePath: data.imagePath || '',
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
    lastShadowingRating: data.lastShadowingRating || '',
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
    imageUrl: payload.imageUrl || '',
    imagePath: payload.imagePath || '',
    lastShadowingRating: '',
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
    imageUrl: payload.imageUrl || '',
    imagePath: payload.imagePath || '',
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

export const updateLessonAudio = async (lessonId, payload) => {
  if (!lessonId) return;
  return updateDoc(doc(db, 'lessons', lessonId), {
    audioPath: payload?.audioPath || '',
    audioUrl: payload?.audioUrl || '',
    audioContentType: payload?.audioContentType || '',
    updatedAt: serverTimestamp(),
  });
};

export const updateLessonImage = async (lessonId, payload) => {
  if (!lessonId) return;
  return updateDoc(doc(db, 'lessons', lessonId), {
    imagePath: payload?.imagePath || '',
    imageUrl: payload?.imageUrl || '',
    updatedAt: serverTimestamp(),
  });
};

export const createStudyLog = async (payload) => {
  return addDoc(collection(db, 'studyLogs'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
};


export const fetchStudyLogs = async (userId) => {
  const q = query(collection(db, 'studyLogs'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const fetchStudyLogsInRange = async (userId, startDate, endDate) => {
  const q = query(
    collection(db, 'studyLogs'),
    where('userId', '==', userId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<', Timestamp.fromDate(endDate)),
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const fetchStudyLogsBeforeDate = async (userId, endDateExclusive) => {
  const q = query(
    collection(db, 'studyLogs'),
    where('userId', '==', userId),
    where('createdAt', '<', Timestamp.fromDate(endDateExclusive)),
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const fetchMonthlyStatsByMonthKeys = async (userId, monthKeys = []) => {
  if (!userId || monthKeys.length === 0) return [];
  const q = query(collection(db, 'monthlyStats'), where('userId', '==', userId));
  const snap = await getDocs(q);
  const set = new Set(monthKeys);
  return snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((item) => set.has(item.monthKey));
};

export const fetchMonthlyStats = async (userId) => {
  if (!userId) return [];
  const q = query(collection(db, 'monthlyStats'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const upsertMonthlyStat = async (userId, monthKey, payload) => {
  const docId = `${userId}_${monthKey}`;
  const ref = doc(db, 'monthlyStats', docId);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...payload,
      userId,
      monthKey,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
  return { existed: existing.exists(), id: docId };
};

export const deleteStudyLogsByIds = async (ids = []) => {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.delete(doc(db, 'studyLogs', id));
  });
  await batch.commit();
};

export const updateLessonStats = async (lessonId, trainingType, durationSeconds, options = {}) => {
  const { shadowingRating = '' } = options;
  const lessonRef = doc(db, 'lessons', lessonId);
  const snap = await getDoc(lessonRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const totalStudySeconds = data.totalStudySeconds || 0;

  await updateDoc(lessonRef, {
    lastShadowingRating: trainingType === 'shadowing' && shadowingRating ? shadowingRating : data.lastShadowingRating || '',
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
