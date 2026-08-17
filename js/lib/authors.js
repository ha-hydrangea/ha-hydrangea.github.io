function normalise(name) {
  return String(name ?? '').replace(/\*+$/, '').trim().toLowerCase();
}

/** Pairs each author with whether it is the site owner, for bold rendering. */
export function splitAuthors(authors, me) {
  const target = normalise(me);
  return (authors ?? []).map((name) => ({
    name,
    isSelf: target !== '' && normalise(name) === target,
  }));
}
