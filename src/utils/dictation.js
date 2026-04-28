const AUTO_IGNORED_DICTATION_PUNCTUATION = [',', '.', '?', ':', ';', '"', '“', '”', "'", '‘', '’', '。', '、', '？', '！', '：', '；'];
const PUNCTUATION_REGEX = new RegExp(`[${AUTO_IGNORED_DICTATION_PUNCTUATION.join('')}]`, 'g');

export const normalizeForDictation = (text) =>
  String(text ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(PUNCTUATION_REGEX, '')
    .toLowerCase();

export const isDictationAnswerCorrect = (inputText, correctScript) =>
  normalizeForDictation(inputText) === normalizeForDictation(correctScript);

export const normalizeText = normalizeForDictation;
