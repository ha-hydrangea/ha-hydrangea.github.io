/** Classic Levenshtein distance. Used only to warn about near-duplicate tags. */
export function editDistance(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  if (left === right) return 0;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,      // insertion
        previous[j] + 1,         // deletion
        previous[j - 1] + cost,  // substitution
      );
    }
    previous = current;
  }

  return previous[right.length];
}
