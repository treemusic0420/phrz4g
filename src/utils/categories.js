export const normalizeSlug = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

export const normalizeName = (value = '') => String(value || '').trim();

export const getDuplicateSlugError = () => '同じslugのカテゴリが既に存在します。';
