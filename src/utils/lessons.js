import { toDate } from './format';

export const UNCATEGORIZED_LABEL = '未分類';
export const UNCATEGORIZED_KEY = '__uncategorized__';
export const LESSONS_PER_PAGE = 10;

export const normalizeCategory = (category) => {
  if (typeof category !== 'string') return UNCATEGORIZED_LABEL;
  const trimmed = category.trim();
  return trimmed ? trimmed : UNCATEGORIZED_LABEL;
};

export const categoryToKey = (categoryName) => {
  if (categoryName === UNCATEGORIZED_LABEL) return UNCATEGORIZED_KEY;
  return encodeURIComponent(categoryName);
};

export const keyToCategory = (categoryKey = '') => {
  if (!categoryKey || categoryKey === UNCATEGORIZED_KEY) return UNCATEGORIZED_LABEL;
  return decodeURIComponent(categoryKey);
};

const safeMillis = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return 0;
  return date.getTime();
};

export const getLessonSortTime = (lesson) => {
  const lastStudiedAt = safeMillis(lesson?.lastStudiedAt);
  const updatedAt = safeMillis(lesson?.updatedAt);
  const createdAt = safeMillis(lesson?.createdAt);
  return lastStudiedAt || updatedAt || createdAt || 0;
};

export const sortLessonsByRecency = (lessons = []) =>
  [...lessons].sort((a, b) => getLessonSortTime(b) - getLessonSortTime(a));

export const groupLessonsByCategory = (lessons = []) => {
  const grouped = new Map();

  sortLessonsByRecency(lessons).forEach((lesson) => {
    const categoryName = normalizeCategory(lesson.category);
    if (!grouped.has(categoryName)) {
      grouped.set(categoryName, {
        name: categoryName,
        key: categoryToKey(categoryName),
        lessons: [],
        count: 0,
        totalStudySeconds: 0,
        latestActivityTime: 0,
      });
    }

    const row = grouped.get(categoryName);
    const sortTime = getLessonSortTime(lesson);
    row.lessons.push(lesson);
    row.count += 1;
    row.totalStudySeconds += Number(lesson.totalStudySeconds) || 0;
    row.latestActivityTime = Math.max(row.latestActivityTime, sortTime);
  });

  return Array.from(grouped.values()).sort((a, b) => b.latestActivityTime - a.latestActivityTime);
};

export const paginateLessons = (lessons = [], currentPage = 1, perPage = LESSONS_PER_PAGE) => {
  const total = lessons.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const start = (page - 1) * perPage;
  return {
    page,
    totalPages,
    total,
    items: lessons.slice(start, start + perPage),
  };
};
