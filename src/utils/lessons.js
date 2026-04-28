import { toDate } from './format';
import { getRegisteredMonthLabel, resolveRegisteredMonthFields } from './registeredMonth';

export const LESSONS_PER_PAGE = 10;
export const UNSET_CATEGORY_LABEL = 'Not set';
export const DELETED_CATEGORY_LABEL = 'Deleted category';

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

const safePrimarySortMillis = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return -1;
  return date.getTime();
};

export const getLessonMonthTrainingSortTime = (lesson) => {
  const createdAt = safePrimarySortMillis(lesson?.createdAt);
  if (createdAt > 0) return createdAt;
  return safePrimarySortMillis(lesson?.updatedAt);
};

export const sortLessonsForMonthTraining = (lessons = []) =>
  [...lessons].sort((a, b) => getLessonMonthTrainingSortTime(b) - getLessonMonthTrainingSortTime(a));

export const toOrderNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

export const sortCategories = (categories = []) =>
  [...categories].sort((a, b) => {
    const orderDiff = toOrderNumber(a.order) - toOrderNumber(b.order);
    if (orderDiff !== 0) return orderDiff;
    return (a.name || '').localeCompare(b.name || '', 'ja');
  });

export const groupLessonsByCategory = (lessons = [], categories = []) => {
  const sortedCategories = sortCategories(categories);
  const grouped = new Map(
    sortedCategories.map((category) => [
      category.id,
      {
        id: category.id,
        name: category.name,
        slug: category.slug,
        isActive: !!category.isActive,
        order: toOrderNumber(category.order),
        count: 0,
        monthCount: 0,
        monthSet: new Set(),
        totalStudySeconds: 0,
        latestActivityTime: 0,
      },
    ]),
  );

  sortLessonsByRecency(lessons).forEach((lesson) => {
    const categoryId = lesson.categoryId || '';
    const monthFields = resolveRegisteredMonthFields(lesson);
    if (!categoryId) {
      const key = '__unset__';
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: UNSET_CATEGORY_LABEL,
          slug: '',
          isActive: true,
          order: Number.MAX_SAFE_INTEGER,
          count: 0,
          monthCount: 0,
          monthSet: new Set(),
          totalStudySeconds: 0,
          latestActivityTime: 0,
        });
      }
      const row = grouped.get(key);
      const sortTime = getLessonSortTime(lesson);
      row.count += 1;
      row.monthSet.add(monthFields.registeredMonth);
      row.totalStudySeconds += Number(lesson.totalStudySeconds) || 0;
      row.latestActivityTime = Math.max(row.latestActivityTime, sortTime);
      return;
    }

    if (!grouped.has(categoryId)) {
      grouped.set(categoryId, {
        id: categoryId,
        name: DELETED_CATEGORY_LABEL,
        slug: '',
        isActive: true,
        order: Number.MAX_SAFE_INTEGER,
        count: 0,
        monthCount: 0,
        monthSet: new Set(),
        totalStudySeconds: 0,
        latestActivityTime: 0,
      });
    }

    const row = grouped.get(categoryId);
    const sortTime = getLessonSortTime(lesson);
    row.count += 1;
    row.monthSet.add(monthFields.registeredMonth);
    row.totalStudySeconds += Number(lesson.totalStudySeconds) || 0;
    row.latestActivityTime = Math.max(row.latestActivityTime, sortTime);
  });

  return Array.from(grouped.values())
    .map((row) => ({ ...row, monthCount: row.monthSet.size }))
    .filter((category) => category.count > 0 || category.isActive)
    .sort((a, b) => {
      const orderDiff = toOrderNumber(a.order) - toOrderNumber(b.order);
      if (orderDiff !== 0) return orderDiff;
      return (a.name || '').localeCompare(b.name || '', 'ja');
    });
};

export const groupLessonsByRegisteredMonth = (lessons = []) => {
  const grouped = new Map();

  sortLessonsByRecency(lessons).forEach((lesson) => {
    const monthFields = resolveRegisteredMonthFields(lesson);
    const key = monthFields.registeredMonth;
    if (!grouped.has(key)) {
      grouped.set(key, {
        registeredMonth: key,
        registeredMonthLabel: monthFields.registeredMonthLabel || getRegisteredMonthLabel(key),
        count: 0,
        totalStudySeconds: 0,
        latestActivityTime: 0,
      });
    }

    const row = grouped.get(key);
    row.count += 1;
    row.totalStudySeconds += Number(lesson.totalStudySeconds) || 0;
    row.latestActivityTime = Math.max(row.latestActivityTime, getLessonSortTime(lesson));
  });

  return Array.from(grouped.values()).sort((a, b) =>
    String(b.registeredMonth).localeCompare(String(a.registeredMonth)),
  );
};

export const filterLessonsByCategoryAndMonth = (lessons = [], categoryId = '', registeredMonth = '') =>
  lessons.filter((lesson) => {
    if (lesson.categoryId !== categoryId) return false;
    const monthFields = resolveRegisteredMonthFields(lesson);
    return monthFields.registeredMonth === registeredMonth;
  });

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

export const hasLessonAudio = (lesson = {}) => !!(lesson?.audioUrl || lesson?.audioPath);
export const hasLessonImage = (lesson = {}) => !!(lesson?.imageUrl || lesson?.imagePath);

export const getLessonDisplayTitle = (lesson = {}, maxLength = 120) => {
  const title = String(lesson?.title || '').trim();
  if (title) return title;
  const scriptHead = String(lesson?.scriptEn || '').replace(/\s+/g, ' ').trim();
  if (scriptHead) return scriptHead.slice(0, maxLength);
  return 'Untitled lesson';
};
