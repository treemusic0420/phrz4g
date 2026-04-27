const PUNCTUATION_REGEX = /[.,?!:;"“”"'‘’。、？！：；]/g;

export const normalizeText = (text) =>
  String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(PUNCTUATION_REGEX, '')
    .toLowerCase();

export const isDictationAnswerCorrect = (inputText, correctScript) =>
  normalizeText(inputText) === normalizeText(correctScript);
