/** A null active tag means "show everything". */
export function matchesTag(itemTags, activeTag) {
  if (!activeTag) return true;
  return (itemTags ?? []).includes(activeTag);
}
