import { dateSortKey } from './format.js';

/** Newest first. Stable for ties. Returns a new array. */
export function sortByDateDesc(items, getDate) {
  return (items ?? [])
    .map((item, index) => ({ item, index, key: dateSortKey(getDate(item)) }))
    .sort((a, b) => (b.key - a.key) || (a.index - b.index))
    .map((entry) => entry.item);
}

/** [{year, items}] with years descending; entry order inside a year is preserved. */
export function groupPublicationsByYear(pubs) {
  const buckets = new Map();
  for (const pub of pubs ?? []) {
    const year = Number(pub.year);
    if (!buckets.has(year)) buckets.set(year, []);
    buckets.get(year).push(pub);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }));
}

/** Sorted union of every `tags` array found across the given lists. */
export function collectTags(...lists) {
  const tags = new Set();
  for (const list of lists) {
    for (const item of list ?? []) {
      for (const tag of item.tags ?? []) tags.add(tag);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
