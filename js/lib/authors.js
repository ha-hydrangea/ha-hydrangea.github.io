function normalise(name) {
  return String(name ?? '').replace(/\*+$/, '').trim().toLowerCase();
}

/**
 * Pairs each author with whether it is the site owner, for bold rendering.
 * A non-array `authors` (a hand-edited `"authors": "T. Owner"`) yields no authors
 * rather than throwing — one bad entry must never take the section down with it.
 */
export function splitAuthors(authors, me) {
  const target = normalise(me);
  return (Array.isArray(authors) ? authors : []).map((name) => ({
    name,
    isSelf: target !== '' && normalise(name) === target,
  }));
}
