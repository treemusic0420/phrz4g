const PUNCTUATION_REGEX = /[.,?!:;"“”"'‘’。、？！：；]/g;

export const normalizeForDictation = (text) =>
  String(text ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(PUNCTUATION_REGEX, '')
    .toLowerCase();

export const isDictationAnswerCorrect = (inputText, correctScript) =>
  normalizeForDictation(inputText) === normalizeForDictation(correctScript);

export const normalizeText = normalizeForDictation;
