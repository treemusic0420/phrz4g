export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const DIFFICULTY_SET = new Set(DIFFICULTY_OPTIONS.map((option) => option.value));

export const normalizeDifficulty = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return DIFFICULTY_SET.has(normalized) ? normalized : 'easy';
};

export const getDifficultyLabel = (value) => {
  const normalized = normalizeDifficulty(value);
  return DIFFICULTY_OPTIONS.find((option) => option.value === normalized)?.label || 'Easy';
};
