const AUTO_IGNORED_DICTATION_CHARS = [
  ',', '.', '+', '?', ':', ';', '"', '“', '”', "'", '‘', '’', '。', '、', '？', '！', '：', '；',
  '-', '&', '/', '%',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];
const escapeRegexChar = (char) => char.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');
const AUTO_IGNORED_DICTATION_CHAR_REGEX = new RegExp(
  `[${AUTO_IGNORED_DICTATION_CHARS.map(escapeRegexChar).join('')}]`,
  'g',
);

export const normalizeForDictation = (text) =>
  String(text ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(AUTO_IGNORED_DICTATION_CHAR_REGEX, '')
    .toLowerCase();

export const isDictationAnswerCorrect = (inputText, correctScript) =>
  normalizeForDictation(inputText) === normalizeForDictation(correctScript);

export const normalizeText = normalizeForDictation;
