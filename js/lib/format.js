const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_PATTERN = /^(\d{4})(?:-(\d{2}))?$/;

/** "2026-08" -> "Aug 2026"; "2026" -> "2026"; anything else -> unchanged. */
export function formatDate(value) {
  if (typeof value !== 'string' || value === '') return '';
  const match = DATE_PATTERN.exec(value);
  if (!match) return value;
  const [, year, month] = match;
  if (!month) return year;
  const index = Number(month) - 1;
  if (index < 0 || index > 11) return value;
  return `${MONTHS[index]} ${year}`;
}

/** { start, end } -> "Mar 2025 – Present". An absent end means ongoing. */
export function formatPeriod(period) {
  if (!period || !period.start) return '';
  const start = formatDate(period.start);
  const end = period.end ? formatDate(period.end) : 'Present';
  return start === end ? start : `${start} – ${end}`;
}

/** Numeric key for descending sorts. Year-only values sort below that year's months. */
export function dateSortKey(value) {
  const match = DATE_PATTERN.exec(typeof value === 'string' ? value : '');
  if (!match) return -1;
  return Number(match[1]) * 100 + (match[2] ? Number(match[2]) : 0);
}
