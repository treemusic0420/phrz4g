const normalize = (text = '') =>
  text
    .toLowerCase()
    .replace(/[^\w\s]|_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const diffWords = (input, correct) => {
  const a = normalize(input).split(' ').filter(Boolean);
  const b = normalize(correct).split(' ').filter(Boolean);

  const result = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const inputWord = a[i] ?? '';
    const correctWord = b[i] ?? '';
    result.push({
      index: i,
      inputWord,
      correctWord,
      match: inputWord === correctWord,
    });
  }
  return result;
};
