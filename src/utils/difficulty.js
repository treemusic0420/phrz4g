export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const DIFFICULTY_SET = new Set(DIFFICULTY_OPTIONS.map((option) => option.value));
const DIFFICULTY_STYLE_MAP = {
  easy: {
    tone: 'difficulty-easy',
    label: 'Easy',
  },
  normal: {
    tone: 'difficulty-normal',
    label: 'Normal',
  },
  hard: {
    tone: 'difficulty-hard',
    label: 'Hard',
  },
};

export const normalizeDifficulty = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return DIFFICULTY_SET.has(normalized) ? normalized : 'easy';
};

const normalizeDifficultyForDisplay = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return DIFFICULTY_SET.has(normalized) ? normalized : 'normal';
};

export const getDifficultyLabel = (value) => {
  return getDifficultyStyle(value).label;
};

export const getDifficultyStyle = (value) => {
  const normalized = normalizeDifficultyForDisplay(value);
  return DIFFICULTY_STYLE_MAP[normalized] || DIFFICULTY_STYLE_MAP.normal;
};
