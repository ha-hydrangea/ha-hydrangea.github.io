# Résumé Site Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the static résumé page — a single-page archive of publications, projects, experience, and awards, rendered from JSON data files and hosted on GitHub Pages.

**Architecture:** `index.html` ships a static skeleton with empty section containers. `js/render.js` fetches six JSON files in parallel and mounts one DOM fragment per section. All data transformation lives in pure functions under `js/lib/`, which are unit-tested with Node's built-in test runner; DOM assembly is a thin layer over those functions. A dependency-free `tools/validate.js` guards data quality before every commit.

**Tech Stack:** Vanilla HTML/CSS/ES modules. Node 26 built-in test runner (`node --test`). No build step, no runtime dependencies, no framework. GitHub Pages for hosting.

**Spec:** `docs/superpowers/specs/2026-08-15-personal-web-design.md` (sections 1–6, 9, 11 are in scope for this plan).

**Out of scope for this plan** (covered by Plans 2 and 3): `feed.html`, `stats.html`, `admin.html`, `js/beacon.js`, the Cloudflare Worker, D1, R2, `tools/backup.js`.

## Global Constraints

- **Zero runtime dependencies.** `package.json` must never gain a `dependencies` or `devDependencies` block. Tests run on Node's built-in runner only.
- **No build step.** Files are served exactly as they exist in the repo.
- **ES modules everywhere.** `package.json` sets `"type": "module"`; browser scripts use `<script type="module">`.
- **Language: English only.** All user-visible copy in the HTML and JSON is English.
- **Dates are strings** matching `^\d{4}(-\d{2})?$`. Never construct a `Date` object from résumé data.
- **`period.end: null` renders as `"Present"`.**
- Sorting is the renderer's responsibility. JSON array order carries no meaning.
- Tag vocabulary is derived from the data. Never introduce a separate tag list file.
- One failing section must never blank the page: use `Promise.allSettled` and per-entry skipping.
- Local preview is `npx serve .` — `file://` will not work because of `fetch` CORS.
- Node's test runner discovers `tests/**/*.test.js`. Run everything with `node --test`.
- Shell commands in this plan are POSIX and must run through the **Bash tool (Git Bash)**, not PowerShell. `touch`, `printf`, `cp -r`, `mkdir -p`, and `$(...)` are used throughout.
- Commit after every task. Commit messages use Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `package.json` | Declares `"type": "module"` and the `test` script. No dependencies, ever. |
| `.gitignore` | Ignores `backup/`, `node_modules/`, `.wrangler/`, OS cruft. |
| `.nojekyll` | Tells GitHub Pages to serve files verbatim instead of running Jekyll. |
| `js/lib/format.js` | Date and period formatting; numeric sort keys. Pure. |
| `js/lib/collection.js` | Sorting, year grouping, tag collection. Pure. |
| `js/lib/authors.js` | Marks the owner's name inside an author list. Pure. |
| `js/lib/tagfilter.js` | The tag-match predicate. Pure. |
| `js/lib/distance.js` | Edit distance, used only by the validator's typo warning. Pure. |
| `js/render.js` | Fetch orchestration + one render function per section. Only file that touches the DOM for content. |
| `js/filter.js` | Builds filter buttons, owns active-tag state, toggles classes on rendered nodes. |
| `js/nav.js` | Smooth scroll, scroll spy, theme toggle. |
| `css/style.css` | Design tokens, layout, dark mode, print styles. |
| `index.html` | Static skeleton: head meta, JSON-LD, nav, empty section containers. |
| `data/*.json` | Six content files (see spec §4). |
| `tools/validate.js` | Data validator. Exported function + CLI entry point. |
| `tools/fetch-fonts.js` | One-shot script that localises the webfonts into `assets/fonts/`. |
| `tests/*.test.js` | Node test-runner specs, one file per `js/lib` module plus the validator. |
| `tests/fixtures/` | Small valid and invalid data trees used by the validator tests. |

Files are split by responsibility, not by layer: each `js/lib` module owns one transformation and is independently testable, while `render.js` stays a thin, untested-by-machine assembly layer that is verified by eye.

---

### Task 1: Repo scaffold and date formatting

**Files:**
- Create: `package.json`, `.gitignore`, `.nojekyll`
- Create: `js/lib/format.js`
- Test: `tests/format.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatDate(value: string): string`, `formatPeriod(period: {start: string, end: string|null}): string`, `dateSortKey(value: string): number`.

- [ ] **Step 1: Initialise the repository**

```bash
cd "C:/Users/SPADE/Desktop/0P.Personal Web"
git init -b main
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "personal-web",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "validate": "node tools/validate.js",
    "serve": "npx --yes serve ."
  }
}
```

- [ ] **Step 3: Create `.gitignore` and `.nojekyll`**

`.gitignore`:

```gitignore
node_modules/
backup/
.wrangler/
.DS_Store
Thumbs.db
```

`.nojekyll` is an empty file:

```bash
touch .nojekyll
```

- [ ] **Step 4: Write the failing test**

`tests/format.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatPeriod, dateSortKey } from '../js/lib/format.js';

test('formatDate renders year-month as an abbreviated month and year', () => {
  assert.equal(formatDate('2026-08'), 'Aug 2026');
  assert.equal(formatDate('2025-01'), 'Jan 2025');
  assert.equal(formatDate('2025-12'), 'Dec 2025');
});

test('formatDate passes a year-only value straight through', () => {
  assert.equal(formatDate('2026'), '2026');
});

test('formatDate returns an empty string for missing values', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(undefined), '');
  assert.equal(formatDate(null), '');
});

test('formatDate returns unrecognised input unchanged rather than throwing', () => {
  assert.equal(formatDate('summer 2026'), 'summer 2026');
  assert.equal(formatDate('2026-13'), '2026-13');
});

test('formatPeriod renders an open-ended period as Present', () => {
  assert.equal(formatPeriod({ start: '2025-03', end: null }), 'Mar 2025 \u2013 Present');
});

test('formatPeriod renders a closed period as a range', () => {
  assert.equal(formatPeriod({ start: '2024-06', end: '2024-12' }), 'Jun 2024 \u2013 Dec 2024');
});

test('formatPeriod collapses a range whose ends are identical', () => {
  assert.equal(formatPeriod({ start: '2025', end: '2025' }), '2025');
});

test('formatPeriod returns an empty string when there is no start', () => {
  assert.equal(formatPeriod(null), '');
  assert.equal(formatPeriod({ start: '', end: null }), '');
});

test('dateSortKey orders year-month values numerically, newest highest', () => {
  assert.equal(dateSortKey('2026-08'), 202608);
  assert.equal(dateSortKey('2026'), 202600);
  assert.ok(dateSortKey('2026-08') > dateSortKey('2026-07'));
  assert.ok(dateSortKey('2026-01') > dateSortKey('2025-12'));
});

test('dateSortKey sorts unparseable values last', () => {
  assert.equal(dateSortKey('nope'), -1);
  assert.equal(dateSortKey(undefined), -1);
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `node --test tests/format.test.js`
Expected: FAIL — cannot find module `../js/lib/format.js`.

- [ ] **Step 6: Implement `js/lib/format.js`**

```js
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
  return start === end ? start : `${start} \u2013 ${end}`;
}

/** Numeric key for descending sorts. Year-only values sort below that year's months. */
export function dateSortKey(value) {
  const match = DATE_PATTERN.exec(typeof value === 'string' ? value : '');
  if (!match) return -1;
  return Number(match[1]) * 100 + (match[2] ? Number(match[2]) : 0);
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `node --test tests/format.test.js`
Expected: PASS — 10 tests, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore .nojekyll js/lib/format.js tests/format.test.js
git commit -m "feat: add repo scaffold and date formatting helpers"
```

---

### Task 2: Sorting, grouping, and tag collection

**Files:**
- Create: `js/lib/collection.js`
- Test: `tests/collection.test.js`

**Interfaces:**
- Consumes: `dateSortKey` from `js/lib/format.js`.
- Produces: `sortByDateDesc(items: Array, getDate: (item) => string): Array`, `groupPublicationsByYear(pubs: Array): Array<{year: number, items: Array}>`, `collectTags(...lists: Array<Array>): string[]`.

- [ ] **Step 1: Write the failing test**

`tests/collection.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { sortByDateDesc, groupPublicationsByYear, collectTags } from '../js/lib/collection.js';

test('sortByDateDesc puts the newest entry first', () => {
  const items = [
    { id: 'a', date: '2024-05' },
    { id: 'b', date: '2026-01' },
    { id: 'c', date: '2025-11' },
  ];
  const sorted = sortByDateDesc(items, (item) => item.date);
  assert.deepEqual(sorted.map((item) => item.id), ['b', 'c', 'a']);
});

test('sortByDateDesc is stable for equal dates', () => {
  const items = [
    { id: 'first', date: '2025-03' },
    { id: 'second', date: '2025-03' },
    { id: 'third', date: '2025-03' },
  ];
  const sorted = sortByDateDesc(items, (item) => item.date);
  assert.deepEqual(sorted.map((item) => item.id), ['first', 'second', 'third']);
});

test('sortByDateDesc does not mutate its input', () => {
  const items = [{ id: 'a', date: '2024' }, { id: 'b', date: '2026' }];
  sortByDateDesc(items, (item) => item.date);
  assert.deepEqual(items.map((item) => item.id), ['a', 'b']);
});

test('sortByDateDesc pushes unparseable dates to the end', () => {
  const items = [{ id: 'bad', date: '' }, { id: 'good', date: '2020' }];
  const sorted = sortByDateDesc(items, (item) => item.date);
  assert.deepEqual(sorted.map((item) => item.id), ['good', 'bad']);
});

test('groupPublicationsByYear returns year buckets, newest year first', () => {
  const pubs = [
    { title: 'x', year: 2025 },
    { title: 'y', year: 2026 },
    { title: 'z', year: 2025 },
  ];
  const groups = groupPublicationsByYear(pubs);
  assert.deepEqual(groups.map((group) => group.year), [2026, 2025]);
  assert.deepEqual(groups[1].items.map((item) => item.title), ['x', 'z']);
});

test('groupPublicationsByYear returns an empty array for no input', () => {
  assert.deepEqual(groupPublicationsByYear([]), []);
});

test('collectTags returns the sorted union across every list', () => {
  const pubs = [{ tags: ['vision', 'nlp'] }, { tags: ['vision'] }];
  const projects = [{ tags: ['systems'] }, { tags: [] }];
  assert.deepEqual(collectTags(pubs, projects), ['nlp', 'systems', 'vision']);
});

test('collectTags tolerates missing tag arrays and missing lists', () => {
  assert.deepEqual(collectTags([{ title: 'no tags' }], undefined), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/collection.test.js`
Expected: FAIL — cannot find module `../js/lib/collection.js`.

- [ ] **Step 3: Implement `js/lib/collection.js`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/collection.test.js`
Expected: PASS — 8 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add js/lib/collection.js tests/collection.test.js
git commit -m "feat: add sorting, year grouping, and tag collection helpers"
```

---

### Task 3: Author marking and the tag predicate

**Files:**
- Create: `js/lib/authors.js`, `js/lib/tagfilter.js`
- Test: `tests/authors.test.js`, `tests/tagfilter.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `splitAuthors(authors: string[], me: string): Array<{name: string, isSelf: boolean}>`, `matchesTag(itemTags: string[], activeTag: string|null): boolean`.

- [ ] **Step 1: Write the failing tests**

`tests/authors.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAuthors } from '../js/lib/authors.js';

test('splitAuthors flags the owner among the authors', () => {
  const result = splitAuthors(['A. Kim', 'B. Lee'], 'A. Kim');
  assert.deepEqual(result, [
    { name: 'A. Kim', isSelf: true },
    { name: 'B. Lee', isSelf: false },
  ]);
});

test('splitAuthors ignores an equal-contribution asterisk when matching', () => {
  const result = splitAuthors(['A. Kim*', 'B. Lee'], 'A. Kim');
  assert.equal(result[0].isSelf, true);
  assert.equal(result[0].name, 'A. Kim*', 'the asterisk must survive into the rendered name');
});

test('splitAuthors matches case-insensitively and ignores surrounding space', () => {
  assert.equal(splitAuthors([' a. kim '], 'A. Kim')[0].isSelf, true);
});

test('splitAuthors flags nobody when me is missing', () => {
  const result = splitAuthors(['A. Kim', 'B. Lee'], '');
  assert.deepEqual(result.map((author) => author.isSelf), [false, false]);
});

test('splitAuthors returns an empty array for a missing author list', () => {
  assert.deepEqual(splitAuthors(undefined, 'A. Kim'), []);
});
```

`tests/tagfilter.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTag } from '../js/lib/tagfilter.js';

test('matchesTag lets everything through when no tag is active', () => {
  assert.equal(matchesTag(['vision'], null), true);
  assert.equal(matchesTag([], null), true);
});

test('matchesTag keeps only items carrying the active tag', () => {
  assert.equal(matchesTag(['vision', 'nlp'], 'nlp'), true);
  assert.equal(matchesTag(['vision'], 'nlp'), false);
});

test('matchesTag treats a missing tags array as no tags', () => {
  assert.equal(matchesTag(undefined, 'nlp'), false);
  assert.equal(matchesTag(undefined, null), true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/authors.test.js tests/tagfilter.test.js`
Expected: FAIL — both modules missing.

- [ ] **Step 3: Implement both modules**

`js/lib/authors.js`:

```js
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
```

`js/lib/tagfilter.js`:

```js
/** A null active tag means "show everything". */
export function matchesTag(itemTags, activeTag) {
  if (!activeTag) return true;
  return (itemTags ?? []).includes(activeTag);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/authors.test.js tests/tagfilter.test.js`
Expected: PASS — 8 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add js/lib/authors.js js/lib/tagfilter.js tests/authors.test.js tests/tagfilter.test.js
git commit -m "feat: add author marking and tag filter predicate"
```

---

### Task 4: Edit distance for the typo warning

**Files:**
- Create: `js/lib/distance.js`
- Test: `tests/distance.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `editDistance(a: string, b: string): number`.

- [ ] **Step 1: Write the failing test**

`tests/distance.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { editDistance } from '../js/lib/distance.js';

test('editDistance is zero for identical strings', () => {
  assert.equal(editDistance('vision', 'vision'), 0);
});

test('editDistance counts a single transposition as two edits', () => {
  assert.equal(editDistance('vision', 'visoin'), 2);
});

test('editDistance counts a single substitution, insertion, or deletion as one', () => {
  assert.equal(editDistance('vision', 'vosion'), 1);
  assert.equal(editDistance('vision', 'visionn'), 1);
  assert.equal(editDistance('vision', 'visin'), 1);
});

test('editDistance handles empty strings', () => {
  assert.equal(editDistance('', ''), 0);
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('abc', ''), 3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/distance.test.js`
Expected: FAIL — cannot find module `../js/lib/distance.js`.

- [ ] **Step 3: Implement `js/lib/distance.js`**

```js
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
```

Note: `visoin` vs `vision` is two edits under plain Levenshtein because a transposition is
not a single operation here. The validator's threshold accounts for this — see Task 5.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/distance.test.js`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add js/lib/distance.js tests/distance.test.js
git commit -m "feat: add edit distance helper for tag typo detection"
```

---

### Task 5: Data validator

**Files:**
- Create: `tools/validate.js`
- Create: `tests/fixtures/valid/` (six JSON files + `assets/img/x.png`, `assets/cv.pdf`)
- Create: `tests/fixtures/broken/` (six JSON files with deliberate faults)
- Test: `tests/validate.test.js`

**Interfaces:**
- Consumes: `editDistance` from `js/lib/distance.js`.
- Produces: `validate(dataDir: string, options?: { assetExists?: (relPath: string) => Promise<boolean> }): Promise<{ errors: string[], warnings: string[] }>`.
  The CLI entry point prints both lists and exits `1` when `errors` is non-empty.

Spec reference: §9, checks 1–8. Every check below maps to one numbered spec item.

- [ ] **Step 1: Create the valid fixture tree**

```bash
mkdir -p tests/fixtures/valid/data tests/fixtures/valid/assets/img
printf '' > tests/fixtures/valid/assets/cv.pdf
printf '' > tests/fixtures/valid/assets/img/x.png
```

`tests/fixtures/valid/data/profile.json`:

```json
{
  "name": "Test Owner",
  "headline": "M.S. Student in Computer Science",
  "affiliation": "Example University",
  "email": "owner@example.com",
  "photo": "assets/img/x.png",
  "cv": "assets/cv.pdf",
  "bio": "One sentence of biography.",
  "links": [{ "label": "GitHub", "url": "https://github.com/example", "icon": "github" }]
}
```

`tests/fixtures/valid/data/news.json`:

```json
[{ "date": "2026-08", "text": "Something happened.", "url": null }]
```

`tests/fixtures/valid/data/publications.json`:

```json
[{
  "title": "A Paper",
  "authors": ["T. Owner*", "C. Author"],
  "me": "T. Owner",
  "venue": "ICLR",
  "year": 2026,
  "type": "conference",
  "highlight": "Oral",
  "tags": ["vision"],
  "links": { "paper": "https://example.com/paper", "code": "", "project": "" }
}]
```

`tests/fixtures/valid/data/projects.json`:

```json
[{
  "title": "A Project",
  "period": { "start": "2025-03", "end": null },
  "role": "Author",
  "summary": "One line.",
  "description": ["Did a thing."],
  "stack": ["Python"],
  "tags": ["vision"],
  "links": { "repo": "https://github.com/example/repo", "demo": "", "doc": "" },
  "image": "assets/img/x.png"
}]
```

`tests/fixtures/valid/data/experience.json`:

```json
[{
  "org": "Example Lab",
  "logo": "assets/img/x.png",
  "role": "Research Intern",
  "period": { "start": "2024-06", "end": "2024-12" },
  "location": "Seoul, Korea",
  "bullets": ["Did research."],
  "tags": []
}]
```

`tests/fixtures/valid/data/awards.json`:

```json
[{
  "category": "award",
  "title": "An Award",
  "issuer": "Example Foundation",
  "date": "2025-06",
  "detail": "",
  "url": null
}]
```

- [ ] **Step 2: Create the broken fixture tree**

Copy the valid tree, then introduce exactly one fault per rule so each assertion is
unambiguous:

```bash
cp -r tests/fixtures/valid tests/fixtures/broken
```

Then overwrite these four files.

`tests/fixtures/broken/data/profile.json` — missing `bio` (rule 2):

```json
{
  "name": "Test Owner",
  "headline": "M.S. Student in Computer Science",
  "affiliation": "Example University",
  "email": "owner@example.com",
  "photo": "assets/img/missing.png",
  "cv": "assets/cv.pdf",
  "bio": "",
  "links": [{ "label": "GitHub", "url": "github.com/example", "icon": "github" }]
}
```

That file also carries a missing asset (rule 5) and a link without a scheme (rule 4).

`tests/fixtures/broken/data/publications.json` — bad `type` (rule 7) and `me` absent from
`authors` (rule 6):

```json
[{
  "title": "A Paper",
  "authors": ["C. Author"],
  "me": "T. Owner",
  "venue": "ICLR",
  "year": 2026,
  "type": "blogpost",
  "highlight": null,
  "tags": ["vision", "visoin"],
  "links": { "paper": "https://example.com/paper" }
}]
```

The two near-identical tags trigger the rule 8 warning.

`tests/fixtures/broken/data/news.json` — bad date format (rule 3):

```json
[{ "date": "August 2026", "text": "Something happened.", "url": null }]
```

`tests/fixtures/broken/data/awards.json` — wrong top-level type (rule 1):

```json
{ "category": "award", "title": "An Award", "date": "2025" }
```

- [ ] **Step 3: Write the failing test**

`tests/validate.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../tools/validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const validDir = path.join(here, 'fixtures', 'valid', 'data');
const brokenDir = path.join(here, 'fixtures', 'broken', 'data');

function joined(list) {
  return list.join('\n');
}

test('a well-formed data directory produces no errors and no warnings', async () => {
  const result = await validate(validDir);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test('rule 1: a file with the wrong top-level type is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /awards\.json.*expected an array/i);
});

test('rule 2: an empty required field is an error naming the file and field', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /profile\.json.*bio/i);
});

test('rule 3: a date outside YYYY or YYYY-MM is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /news\.json.*date.*August 2026/i);
});

test('rule 4: a link without a recognised scheme is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /profile\.json.*github\.com\/example/i);
});

test('rule 5: an asset path that does not resolve on disk is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /profile\.json.*assets\/img\/missing\.png/i);
});

test('rule 6: me missing from the author list is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /publications\.json.*T\. Owner.*authors/i);
});

test('rule 7: a value outside an enum is an error listing the allowed values', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /publications\.json.*blogpost.*conference/i);
});

test('rule 8: near-identical tags are a warning, not an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.warnings), /vis[oi]{2}n.*vis[oi]{2}n/i);
  assert.equal(
    result.errors.some((line) => /visoin/i.test(line)),
    false,
    'a tag typo must never block a commit',
  );
});

test('a missing data file is reported as an error rather than throwing', async () => {
  const result = await validate(path.join(here, 'fixtures', 'nonexistent'));
  assert.equal(result.errors.length > 0, true);
  assert.match(joined(result.errors), /profile\.json/);
});

test('assetExists can be injected so callers control disk access', async () => {
  const seen = [];
  const result = await validate(validDir, {
    assetExists: async (relativePath) => {
      seen.push(relativePath);
      return true;
    },
  });
  assert.deepEqual(result.errors, []);
  assert.ok(seen.includes('assets/cv.pdf'));
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test tests/validate.test.js`
Expected: FAIL — cannot find module `../tools/validate.js`.

- [ ] **Step 5: Implement `tools/validate.js`**

```js
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { editDistance } from '../js/lib/distance.js';

const DATE_PATTERN = /^\d{4}(-\d{2})?$/;
const LINK_PATTERN = /^(https?:\/\/|mailto:|assets\/)/;
const ASSET_FIELDS = ['photo', 'cv', 'image', 'logo'];

const RULES = {
  'profile.json': {
    kind: 'object',
    required: ['name', 'headline', 'affiliation', 'email', 'bio'],
  },
  'news.json': { kind: 'array', required: ['date', 'text'] },
  'publications.json': {
    kind: 'array',
    required: ['title', 'authors', 'me', 'venue', 'year', 'type'],
    enums: { type: ['conference', 'journal', 'preprint', 'patent'] },
  },
  'projects.json': { kind: 'array', required: ['title', 'period.start', 'summary'] },
  'experience.json': { kind: 'array', required: ['org', 'role', 'period.start'] },
  'awards.json': {
    kind: 'array',
    required: ['category', 'title', 'date'],
    enums: { category: ['award', 'certification', 'education'] },
  },
};

function pluck(entry, dottedPath) {
  return dottedPath.split('.').reduce(
    (value, key) => (value === null || value === undefined ? undefined : value[key]),
    entry,
  );
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function stripStar(name) {
  return String(name ?? '').replace(/\*+$/, '').trim().toLowerCase();
}

/** Walks an entry collecting every string that looks like a link or an asset path. */
function collectPaths(entry) {
  const links = [];
  const assets = [];
  for (const [key, value] of Object.entries(entry ?? {})) {
    if (ASSET_FIELDS.includes(key) && typeof value === 'string' && value !== '') {
      assets.push(value);
      links.push(value);
    } else if (key === 'links' && value && typeof value === 'object') {
      const entries = Array.isArray(value) ? value.map((item) => item?.url) : Object.values(value);
      for (const candidate of entries) {
        if (typeof candidate === 'string' && candidate !== '') links.push(candidate);
      }
    } else if (key === 'url' && typeof value === 'string' && value !== '') {
      links.push(value);
    }
  }
  return { links, assets };
}

async function defaultAssetExists(dataDir, relativePath) {
  const root = path.dirname(dataDir);
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function checkDates(entry, file, label, errors) {
  const candidates = [
    ['date', entry?.date],
    ['period.start', entry?.period?.start],
    ['period.end', entry?.period?.end],
  ];
  for (const [field, value] of candidates) {
    if (value === undefined || value === null) continue;   // null end means "Present"
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
      errors.push(`${file} ${label}: ${field} must be YYYY or YYYY-MM, got "${value}"`);
    }
  }
}

function checkTagTypos(tagsByFile, warnings) {
  const all = [...new Set(Object.values(tagsByFile).flat())];
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      if (editDistance(all[i], all[j]) <= 2 && all[i] !== all[j]) {
        warnings.push(
          `tags "${all[i]}" and "${all[j]}" are nearly identical - is one a typo?`,
        );
      }
    }
  }
}

export async function validate(dataDir, options = {}) {
  const errors = [];
  const warnings = [];
  const assetExists = options.assetExists
    ?? ((relativePath) => defaultAssetExists(dataDir, relativePath));
  const tagsByFile = {};

  for (const [file, rule] of Object.entries(RULES)) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path.join(dataDir, file), 'utf8'));
    } catch (error) {
      errors.push(`${file}: could not be read or parsed (${error.message})`);
      continue;
    }

    const isArray = Array.isArray(parsed);
    if (rule.kind === 'array' && !isArray) {
      errors.push(`${file}: expected an array at the top level`);
      continue;
    }
    if (rule.kind === 'object' && (isArray || typeof parsed !== 'object' || parsed === null)) {
      errors.push(`${file}: expected an object at the top level`);
      continue;
    }

    const entries = isArray ? parsed : [parsed];
    tagsByFile[file] = entries.flatMap((entry) => entry?.tags ?? []);

    for (const [index, entry] of entries.entries()) {
      const label = isArray ? `entry ${index}` : 'object';

      for (const field of rule.required) {
        if (isEmpty(pluck(entry, field))) {
          errors.push(`${file} ${label}: required field "${field}" is missing or empty`);
        }
      }

      for (const [field, allowed] of Object.entries(rule.enums ?? {})) {
        const value = entry?.[field];
        if (value !== undefined && !allowed.includes(value)) {
          errors.push(
            `${file} ${label}: "${field}" is "${value}", expected one of ${allowed.join(', ')}`,
          );
        }
      }

      checkDates(entry, file, label, errors);

      if (file === 'publications.json' && entry?.me) {
        const authors = (entry.authors ?? []).map(stripStar);
        if (!authors.includes(stripStar(entry.me))) {
          errors.push(`${file} ${label}: me "${entry.me}" does not appear in authors`);
        }
      }

      const { links, assets } = collectPaths(entry);
      for (const link of links) {
        if (!LINK_PATTERN.test(link)) {
          errors.push(
            `${file} ${label}: "${link}" must start with http://, https://, mailto:, or assets/`,
          );
        }
      }
      for (const asset of assets) {
        if (!(await assetExists(asset))) {
          errors.push(`${file} ${label}: asset "${asset}" does not exist on disk`);
        }
      }
    }
  }

  checkTagTypos(tagsByFile, warnings);
  return { errors, warnings };
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = process.argv[2] ?? path.join(here, '..', 'data');
  const { errors, warnings } = await validate(dataDir);

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);

  if (errors.length === 0) {
    console.log(`OK - ${path.resolve(dataDir)} passed all checks`);
  }
  process.exit(errors.length === 0 ? 0 : 1);
}
```

Note on the rule 8 threshold: plain Levenshtein scores a transposition such as
`vision`/`visoin` as 2, so the warning triggers at distance ≤ 2. That is why the spec's
"one character apart" is implemented as two edits here.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/validate.test.js`
Expected: PASS — 11 tests, 0 failures.

- [ ] **Step 7: Verify the CLI behaves correctly on both fixture trees**

```bash
node tools/validate.js tests/fixtures/valid/data; echo "exit=$?"
node tools/validate.js tests/fixtures/broken/data; echo "exit=$?"
```

Expected: the first prints `OK - ...` and `exit=0`; the second prints several `error:`
lines plus at least one `warning:` line and `exit=1`.

- [ ] **Step 8: Commit**

```bash
git add tools/validate.js tests/validate.test.js tests/fixtures
git commit -m "feat: add dependency-free résumé data validator"
```

---

### Task 6: Placeholder content

**Files:**
- Create: `data/profile.json`, `data/news.json`, `data/publications.json`, `data/projects.json`, `data/experience.json`, `data/awards.json`
- Create: `assets/img/profile.svg`, `assets/img/logo-lab.svg`, `assets/img/logo-univ.svg`, `assets/img/proj-a.svg`, `assets/img/proj-b.svg`, `assets/cv.pdf`

**Interfaces:**
- Consumes: the schema and required-field table from spec §4; `tools/validate.js` from Task 5.
- Produces: a `data/` tree that passes `node tools/validate.js` and exercises every render path (multi-year publications, an ongoing period, a closed period, all three award categories, an entry with no image).

- [ ] **Step 1: Create placeholder assets**

Real photos come later; these are neutral SVG stand-ins so the layout has correct
aspect ratios from day one.

```bash
mkdir -p assets/img
for name in profile logo-lab logo-univ proj-a proj-b; do
  printf '%s\n' \
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="placeholder">' \
    '<rect width="400" height="400" fill="#d8d8d8"/>' \
    '<text x="200" y="210" font-family="sans-serif" font-size="28" fill="#6b6b6b" text-anchor="middle">'"$name"'</text>' \
    '</svg>' > "assets/img/$name.svg"
done
printf '%%PDF-1.4\n%%placeholder\n' > assets/cv.pdf
```

- [ ] **Step 2: Write `data/profile.json`**

```json
{
  "name": "Your Name",
  "headline": "M.S. Student in Computer Science",
  "affiliation": "Your University",
  "email": "you@example.com",
  "photo": "assets/img/profile.svg",
  "cv": "assets/cv.pdf",
  "bio": "I work on systems that learn from messy real-world data. My current focus is on making large models cheap enough to run where the data already lives. Before graduate school I built data pipelines for a logistics startup.",
  "links": [
    { "label": "GitHub", "url": "https://github.com/yourname", "icon": "github" },
    { "label": "Google Scholar", "url": "https://scholar.google.com/citations?user=example", "icon": "scholar" },
    { "label": "LinkedIn", "url": "https://linkedin.com/in/yourname", "icon": "linkedin" },
    { "label": "Email", "url": "mailto:you@example.com", "icon": "mail" }
  ]
}
```

- [ ] **Step 3: Write `data/news.json`**

```json
[
  { "date": "2026-07", "text": "Our paper on streaming retrieval was accepted to NeurIPS 2026.", "url": "https://example.com/neurips" },
  { "date": "2026-03", "text": "Started as a research intern at Example Lab.", "url": null },
  { "date": "2025-11", "text": "Received the Example Foundation Graduate Fellowship.", "url": null },
  { "date": "2025-06", "text": "Released an open-source toolkit for dataset deduplication.", "url": "https://github.com/yourname/dedupe" }
]
```

- [ ] **Step 4: Write `data/publications.json`**

Two years and a mix of `type` values, so the year grouping and the type badge both get
exercised.

```json
[
  {
    "title": "Streaming Retrieval for Long-Context Language Models",
    "authors": ["Your Name*", "A. Collaborator*", "B. Advisor"],
    "me": "Your Name",
    "venue": "NeurIPS",
    "year": 2026,
    "type": "conference",
    "highlight": "Spotlight",
    "tags": ["retrieval", "efficiency"],
    "links": {
      "paper": "https://arxiv.org/abs/0000.00000",
      "code": "https://github.com/yourname/streaming-retrieval",
      "project": ""
    }
  },
  {
    "title": "On the Cost of Deduplicating Web-Scale Corpora",
    "authors": ["C. Coauthor", "Your Name"],
    "me": "Your Name",
    "venue": "arXiv",
    "year": 2026,
    "type": "preprint",
    "highlight": null,
    "tags": ["data"],
    "links": { "paper": "https://arxiv.org/abs/0000.00001", "code": "", "project": "" }
  },
  {
    "title": "A Cache-Aware Scheduler for Mixed Inference Workloads",
    "authors": ["Your Name", "B. Advisor"],
    "me": "Your Name",
    "venue": "EuroSys",
    "year": 2025,
    "type": "conference",
    "highlight": null,
    "tags": ["systems", "efficiency"],
    "links": { "paper": "https://example.com/eurosys", "code": "", "project": "" }
  }
]
```

- [ ] **Step 5: Write `data/projects.json`**

One ongoing project, one finished, one deliberately without an image so the renderer's
optional-image path is exercised.

```json
[
  {
    "title": "dedupe",
    "period": { "start": "2025-06", "end": null },
    "role": "Author and maintainer",
    "summary": "A streaming near-duplicate detector for text corpora.",
    "description": [
      "Processes 1 TB of text on a single machine using a rolling MinHash index.",
      "Ships a CLI and a Python API; used by three external research groups."
    ],
    "stack": ["Python", "Rust", "PyArrow"],
    "tags": ["data", "efficiency"],
    "links": { "repo": "https://github.com/yourname/dedupe", "demo": "", "doc": "https://example.com/dedupe-docs" },
    "image": "assets/img/proj-a.svg"
  },
  {
    "title": "Campus Transit Dashboard",
    "period": { "start": "2024-09", "end": "2025-02" },
    "role": "Frontend lead",
    "summary": "Live arrival board for the university shuttle network.",
    "description": [
      "Built the realtime map and the accessibility-first schedule table.",
      "Handled roughly 4,000 daily users during the semester."
    ],
    "stack": ["TypeScript", "Leaflet"],
    "tags": ["systems"],
    "links": { "repo": "https://github.com/yourname/transit", "demo": "https://example.com/transit", "doc": "" },
    "image": "assets/img/proj-b.svg"
  },
  {
    "title": "Paper Reading Notes",
    "period": { "start": "2024-01", "end": null },
    "role": "Author",
    "summary": "Public notes on roughly 120 papers in retrieval and efficiency.",
    "description": ["Updated most weeks; used as the reading list for a lab seminar."],
    "stack": ["Markdown"],
    "tags": ["retrieval"],
    "links": { "repo": "https://github.com/yourname/notes", "demo": "", "doc": "" },
    "image": ""
  }
]
```

- [ ] **Step 6: Write `data/experience.json`**

```json
[
  {
    "org": "Example Lab",
    "logo": "assets/img/logo-lab.svg",
    "role": "Research Intern",
    "period": { "start": "2026-03", "end": null },
    "location": "Seoul, Korea",
    "bullets": [
      "Working on retrieval for long-context models under Prof. B. Advisor.",
      "Built the evaluation harness now used across the group."
    ],
    "tags": ["retrieval"]
  },
  {
    "org": "Your University",
    "logo": "assets/img/logo-univ.svg",
    "role": "Teaching Assistant, Operating Systems",
    "period": { "start": "2025-03", "end": "2025-12" },
    "location": "Seoul, Korea",
    "bullets": [
      "Ran weekly labs for 90 students and rewrote two of the four assignments."
    ],
    "tags": ["systems"]
  },
  {
    "org": "Example Logistics",
    "logo": "",
    "role": "Backend Engineer (Intern)",
    "period": { "start": "2024-06", "end": "2024-08" },
    "location": "Remote",
    "bullets": ["Cut nightly batch runtime from 6 hours to 40 minutes."],
    "tags": ["data"]
  }
]
```

- [ ] **Step 7: Write `data/awards.json`**

All three categories must be present so every sub-block renders.

```json
[
  { "category": "award", "title": "Example Foundation Graduate Fellowship", "issuer": "Example Foundation", "date": "2025-11", "detail": "Awarded to 12 students nationally.", "url": null },
  { "category": "award", "title": "Best Undergraduate Thesis", "issuer": "Your University", "date": "2024-02", "detail": "", "url": null },
  { "category": "certification", "title": "AWS Certified Solutions Architect - Associate", "issuer": "Amazon Web Services", "date": "2024-09", "detail": "", "url": "https://example.com/cert" },
  { "category": "education", "title": "M.S. in Computer Science", "issuer": "Your University", "date": "2025-03", "detail": "Advisor: B. Advisor. Expected 2027.", "url": null },
  { "category": "education", "title": "B.S. in Computer Science", "issuer": "Your University", "date": "2021-03", "detail": "Graduated with honours.", "url": null }
]
```

- [ ] **Step 8: Run the validator against the real data**

Run: `node tools/validate.js`
Expected: `OK - .../data passed all checks`, exit code 0, no warnings.

If a warning about near-identical tags appears, the placeholder tag vocabulary has a
collision — rename one of the tags rather than loosening the validator.

- [ ] **Step 9: Commit**

```bash
git add data assets
git commit -m "feat: add placeholder résumé content and stand-in assets"
```

---

### Task 7: Page skeleton and design tokens

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Consumes: nothing yet — the containers are empty until Task 8.
- Produces: DOM contract for later tasks. Every section container carries a stable id
  and an empty `<div class="section-body" data-section="NAME">` mount point where
  `NAME` is one of `header`, `about`, `news`, `publications`, `projects`, `experience`,
  `awards`. `render.js` in Task 8 mounts strictly into these.

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your Name</title>
<meta name="description" content="Publications, projects, and experience of Your Name.">
<meta property="og:title" content="Your Name">
<meta property="og:description" content="Publications, projects, and experience of Your Name.">
<meta property="og:type" content="profile">
<meta property="og:image" content="assets/img/profile.svg">
<link rel="icon" href="assets/img/favicon.svg">
<link rel="stylesheet" href="css/style.css">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Your Name",
  "affiliation": { "@type": "Organization", "name": "Your University" },
  "email": "mailto:you@example.com",
  "url": "https://example.github.io/"
}
</script>
</head>
<body>

<a class="skip-link" href="#about">Skip to content</a>

<nav class="site-nav" aria-label="Sections">
  <a class="site-nav__name" href="#top">Your Name</a>
  <ul class="site-nav__list">
    <li><a href="#about">About</a></li>
    <li><a href="#news">News</a></li>
    <li><a href="#publications">Publications</a></li>
    <li><a href="#projects">Projects</a></li>
    <li><a href="#experience">Experience</a></li>
    <li><a href="#awards">Awards</a></li>
  </ul>
  <button class="theme-toggle" type="button" aria-label="Switch colour theme" aria-pressed="false">
    <span aria-hidden="true">◑</span>
  </button>
</nav>

<main id="top">

  <header class="profile">
    <div class="section-body" data-section="header"></div>
  </header>

  <section id="about" aria-labelledby="about-heading">
    <h2 id="about-heading">About</h2>
    <div class="section-body" data-section="about"></div>
  </section>

  <section id="news" aria-labelledby="news-heading">
    <h2 id="news-heading">News</h2>
    <div class="section-body news-scroll" data-section="news"></div>
  </section>

  <section id="publications" aria-labelledby="publications-heading">
    <h2 id="publications-heading">Publications</h2>
    <div class="tag-filter" role="group" aria-label="Filter by topic"></div>
    <div class="section-body" data-section="publications"></div>
  </section>

  <section id="projects" aria-labelledby="projects-heading">
    <h2 id="projects-heading">Projects</h2>
    <div class="section-body" data-section="projects"></div>
  </section>

  <section id="experience" aria-labelledby="experience-heading">
    <h2 id="experience-heading">Experience</h2>
    <div class="section-body" data-section="experience"></div>
  </section>

  <section id="awards" aria-labelledby="awards-heading">
    <h2 id="awards-heading">Awards &amp; Education</h2>
    <div class="section-body" data-section="awards"></div>
  </section>

</main>

<footer class="site-footer">
  <p><a href="mailto:you@example.com">you@example.com</a> · <a href="assets/cv.pdf">CV</a></p>
  <p class="site-footer__meta">Last updated 2026</p>
</footer>

<script type="module" src="js/nav.js"></script>
<script type="module" src="js/filter.js"></script>
<script type="module" src="js/render.js"></script>
</body>
</html>
```

**The order of these three tags is load-bearing.** `render.js` uses top-level `await`,
and a module script with top-level await delays every module script after it. `filter.js`
registers a listener for the event `render.js` fires, so it must be evaluated *before*
`render.js` — hence this order. Do not reorder them.

- [ ] **Step 2: Create the favicon**

```bash
printf '%s' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1a1a1a"/><text x="16" y="22" font-family="Georgia,serif" font-size="18" fill="#fafafa" text-anchor="middle">Y</text></svg>' > assets/img/favicon.svg
```

- [ ] **Step 3: Write `css/style.css`**

Tokens first, then layout. Every colour in the file must come from a token so the dark
theme is a single block of overrides.

```css
:root {
  color-scheme: light dark;

  --font-serif: "Newsreader", Georgia, "Times New Roman", serif;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;

  --bg: #fdfdfc;
  --bg-raised: #f4f4f2;
  --text: #1a1a19;
  --text-muted: #6b6b66;
  --border: #e2e2dd;
  --accent: #1d4ed8;
  --accent-soft: #dbe4fb;

  --measure: 820px;
  --gap: 1.5rem;
  --radius: 6px;
}

:root[data-theme="dark"] {
  --bg: #14140f;
  --bg-raised: #1f1f1a;
  --text: #edece7;
  --text-muted: #a3a29b;
  --border: #33332c;
  --accent: #93b4ff;
  --accent-soft: #22304f;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #14140f;
    --bg-raised: #1f1f1a;
    --text: #edece7;
    --text-muted: #a3a29b;
    --border: #33332c;
    --accent: #93b4ff;
    --accent-soft: #22304f;
  }
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 1rem;
  line-height: 1.6;
  -webkit-text-size-adjust: 100%;
}

a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:focus-visible, button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
  z-index: 20;
  background: var(--bg-raised);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
}

/* ---- Navigation ---- */

.site-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--gap);
  padding: 0.6rem max(1rem, calc((100vw - var(--measure)) / 2));
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}

.site-nav__name {
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
}

.site-nav__list {
  display: flex;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}
.site-nav__list::-webkit-scrollbar { display: none; }

.site-nav__list a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  white-space: nowrap;
}
.site-nav__list a[aria-current="true"] { color: var(--text); font-weight: 600; }

.theme-toggle {
  margin-left: auto;
  background: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.15rem 0.55rem;
  font-size: 0.95rem;
}

/* ---- Layout ---- */

main {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 2.5rem max(1rem, 1.25rem) 4rem;
}

section { margin-top: 3rem; }

h2 {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0 0 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}

.news-scroll {
  max-height: 12rem;
  overflow-y: auto;
}

/* ---- Footer ---- */

.site-footer {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.9rem;
}
.site-footer p { margin: 0.2rem 0; }

/* ---- Responsive ---- */

@media (max-width: 720px) {
  .site-nav { gap: 0.75rem; }
  .site-nav__name { display: none; }
  main { padding-top: 1.5rem; }
}

/* ---- Print ---- */

@media print {
  .site-nav, .theme-toggle, .tag-filter, .skip-link { display: none !important; }
  .news-scroll { max-height: none; overflow: visible; }
  body { background: #fff; color: #000; }
  a { color: #000; text-decoration: none; }
  section { break-inside: avoid; margin-top: 1.5rem; }
}
```

- [ ] **Step 4: Verify the skeleton renders**

```bash
npx --yes serve .
```

Open `http://localhost:3000`. Expected: sticky nav with six links and a theme toggle,
seven empty section headings, and a footer. No console errors other than the three
`404`s for `js/nav.js`, `js/filter.js`, and `js/render.js`, which arrive in Tasks 8–10.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css assets/img/favicon.svg
git commit -m "feat: add page skeleton and design tokens"
```

---

### Task 8: Section renderers

**Files:**
- Create: `js/render.js`

**Interfaces:**
- Consumes: `formatDate`, `formatPeriod` from `js/lib/format.js`; `sortByDateDesc`, `groupPublicationsByYear` from `js/lib/collection.js`; `splitAuthors` from `js/lib/authors.js`; the `data-section` mount points from Task 7.
- Produces: a default-exported side effect on load, plus named exports used by Task 9: `loadData(): Promise<Record<string, unknown>>` and the module-level custom event `data:rendered` dispatched on `document` once every section has mounted. Rendered publication and project nodes carry `data-tags` (a space-separated tag list) for the filter to read.

- [ ] **Step 1: Write `js/render.js`**

```js
import { formatDate, formatPeriod } from './lib/format.js';
import { sortByDateDesc, groupPublicationsByYear } from './lib/collection.js';
import { splitAuthors } from './lib/authors.js';

const FILES = ['profile', 'news', 'publications', 'projects', 'experience', 'awards'];

/** Creates an element with optional class, text, and attributes. */
function el(tag, { className, text, attrs, html } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (html !== undefined) node.innerHTML = html;
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value !== null && value !== undefined && value !== '') node.setAttribute(key, value);
  }
  return node;
}

function linkChips(links) {
  const wrap = el('span', { className: 'chips' });
  for (const [label, url] of Object.entries(links ?? {})) {
    if (!url) continue;
    wrap.append(el('a', { className: 'chip', text: label, attrs: { href: url, rel: 'noopener' } }));
  }
  return wrap;
}

function tagAttr(item) {
  return (item.tags ?? []).join(' ');
}

function mount(name, fragment) {
  const host = document.querySelector(`[data-section="${name}"]`);
  if (!host) return;
  host.replaceChildren(fragment);
}

function hideSection(name, reason) {
  console.warn(`[render] hiding "${name}": ${reason}`);
  const host = document.querySelector(`[data-section="${name}"]`);
  host?.closest('section, header')?.setAttribute('hidden', '');
}

/* ---------- section renderers ---------- */

function renderHeader(profile) {
  const frag = document.createDocumentFragment();
  if (profile.photo) {
    frag.append(el('img', {
      className: 'profile__photo',
      attrs: { src: profile.photo, alt: '', width: '160', height: '160' },
    }));
  }
  const body = el('div', { className: 'profile__text' });
  body.append(el('h1', { className: 'profile__name', text: profile.name }));
  body.append(el('p', { className: 'profile__headline', text: profile.headline }));
  body.append(el('p', { className: 'profile__affiliation', text: profile.affiliation }));

  const links = el('p', { className: 'profile__links' });
  for (const link of profile.links ?? []) {
    // Both are required: a URL with no label renders an anchor with no
    // discernible text, and the validator does not enforce link labels.
    if (!link.url || !link.label) { console.warn('[render] skipping profile link', link); continue; }
    links.append(el('a', { text: link.label, attrs: { href: link.url, rel: 'noopener' } }));
  }
  if (profile.cv) links.append(el('a', { text: 'CV', attrs: { href: profile.cv } }));
  body.append(links);

  frag.append(body);
  return frag;
}

function renderAbout(profile) {
  const frag = document.createDocumentFragment();
  frag.append(el('p', { text: profile.bio }));
  return frag;
}

function renderNews(items) {
  const list = el('ul', { className: 'news' });
  for (const item of sortByDateDesc(items, (entry) => entry.date)) {
    if (!item.date || !item.text) { console.warn('[render] skipping news entry', item); continue; }
    const row = el('li');
    row.append(el('time', { className: 'news__date', text: formatDate(item.date) }));
    row.append(item.url
      ? el('a', { text: item.text, attrs: { href: item.url, rel: 'noopener' } })
      : el('span', { text: item.text }));
    list.append(row);
  }
  const frag = document.createDocumentFragment();
  frag.append(list);
  return frag;
}

function renderPublications(items) {
  const frag = document.createDocumentFragment();
  for (const group of groupPublicationsByYear(items)) {
    frag.append(el('h3', { className: 'year', text: String(group.year) }));
    const list = el('ul', { className: 'pub-list' });
    for (const pub of group.items) {
      if (!pub.title) { console.warn('[render] skipping publication', pub); continue; }
      const row = el('li', { className: 'pub', attrs: { 'data-tags': tagAttr(pub) } });
      row.append(el('span', { className: 'pub__title', text: pub.title }));

      const authors = el('span', { className: 'pub__authors' });
      splitAuthors(pub.authors, pub.me).forEach((author, index) => {
        if (index > 0) authors.append(document.createTextNode(', '));
        authors.append(el(author.isSelf ? 'strong' : 'span', { text: author.name }));
      });
      row.append(authors);

      const meta = el('span', { className: 'pub__meta' });
      meta.append(el('em', { text: pub.venue }));
      meta.append(document.createTextNode(` ${pub.year}`));
      if (pub.highlight) meta.append(el('span', { className: 'badge', text: pub.highlight }));
      row.append(meta);

      row.append(linkChips(pub.links));
      list.append(row);
    }
    frag.append(list);
  }
  return frag;
}

function renderProjects(items) {
  const grid = el('div', { className: 'card-grid' });
  for (const project of sortByDateDesc(items, (entry) => entry.period?.start)) {
    if (!project.title) { console.warn('[render] skipping project', project); continue; }
    const card = el('article', { className: 'card', attrs: { 'data-tags': tagAttr(project) } });
    if (project.image) {
      card.append(el('img', {
        className: 'card__image',
        attrs: { src: project.image, alt: '', loading: 'lazy', width: '400', height: '400' },
      }));
    }
    card.append(el('h3', { className: 'card__title', text: project.title }));
    card.append(el('p', { className: 'card__period', text: formatPeriod(project.period) }));
    card.append(el('p', { className: 'card__summary', text: project.summary }));

    if (project.description?.length) {
      const bullets = el('ul', { className: 'card__bullets' });
      for (const line of project.description) bullets.append(el('li', { text: line }));
      card.append(bullets);
    }

    const stack = el('p', { className: 'stack' });
    for (const item of project.stack ?? []) stack.append(el('span', { className: 'chip chip--muted', text: item }));
    card.append(stack);
    card.append(linkChips(project.links));
    grid.append(card);
  }
  const frag = document.createDocumentFragment();
  frag.append(grid);
  return frag;
}

function renderExperience(items) {
  const list = el('ul', { className: 'exp-list' });
  for (const job of sortByDateDesc(items, (entry) => entry.period?.start)) {
    if (!job.org || !job.role) { console.warn('[render] skipping experience entry', job); continue; }
    const row = el('li', { className: 'exp' });
    if (job.logo) {
      row.append(el('img', {
        className: 'exp__logo',
        attrs: { src: job.logo, alt: '', loading: 'lazy', width: '48', height: '48' },
      }));
    }
    const body = el('div', { className: 'exp__body' });
    body.append(el('h3', { className: 'exp__role', text: job.role }));
    body.append(el('p', { className: 'exp__org', text: [job.org, job.location].filter(Boolean).join(' · ') }));
    body.append(el('p', { className: 'exp__period', text: formatPeriod(job.period) }));
    if (job.bullets?.length) {
      const bullets = el('ul');
      for (const line of job.bullets) bullets.append(el('li', { text: line }));
      body.append(bullets);
    }
    row.append(body);
    list.append(row);
  }
  const frag = document.createDocumentFragment();
  frag.append(list);
  return frag;
}

const AWARD_GROUPS = [
  ['education', 'Education'],
  ['award', 'Awards'],
  ['certification', 'Certifications'],
];
const AWARD_CATEGORIES = new Set(AWARD_GROUPS.map(([category]) => category));

function renderAwards(items) {
  const frag = document.createDocumentFragment();

  // Every other skip path in this file warns; an unrecognised category would
  // otherwise vanish from the page with no trace.
  for (const item of items) {
    if (!AWARD_CATEGORIES.has(item.category)) {
      console.warn('[render] award entry has an unknown category', item);
    }
  }

  for (const [category, heading] of AWARD_GROUPS) {
    const inGroup = sortByDateDesc(
      items.filter((item) => item.category === category),
      (entry) => entry.date,
    );
    if (inGroup.length === 0) continue;
    frag.append(el('h3', { className: 'subhead', text: heading }));
    const list = el('ul', { className: 'award-list' });
    for (const item of inGroup) {
      if (!item.title) { console.warn('[render] skipping award entry', item); continue; }
      const row = el('li');
      row.append(el('span', { className: 'award__date', text: formatDate(item.date) }));
      const body = el('span', { className: 'award__body' });
      body.append(item.url
        ? el('a', { text: item.title, attrs: { href: item.url, rel: 'noopener' } })
        : el('span', { text: item.title }));
      if (item.issuer) body.append(el('span', { className: 'award__issuer', text: item.issuer }));
      if (item.detail) body.append(el('span', { className: 'award__detail', text: item.detail }));
      row.append(body);
      list.append(row);
    }
    frag.append(list);
  }
  return frag;
}

/* ---------- orchestration ---------- */

export async function loadData() {
  const settled = await Promise.allSettled(
    FILES.map(async (name) => {
      const response = await fetch(`data/${name}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return [name, await response.json()];
    }),
  );

  const data = {};
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      const [name, value] = outcome.value;
      data[name] = value;
    } else {
      console.warn(`[render] data/${FILES[index]}.json failed: ${outcome.reason.message}`);
    }
  });
  return data;
}

function renderAll(data) {
  const sections = [
    ['header', data.profile, renderHeader],
    ['about', data.profile, renderAbout],
    ['news', data.news, renderNews],
    ['publications', data.publications, renderPublications],
    ['projects', data.projects, renderProjects],
    ['experience', data.experience, renderExperience],
    ['awards', data.awards, renderAwards],
  ];

  for (const [name, payload, renderer] of sections) {
    if (payload === undefined) { hideSection(name, 'data file unavailable'); continue; }
    try {
      mount(name, renderer(payload));
    } catch (error) {
      hideSection(name, error.message);
    }
  }
}

const data = await loadData();
renderAll(data);
document.dispatchEvent(new CustomEvent('data:rendered', { detail: data }));
```

- [ ] **Step 2: Verify every section renders**

```bash
npx --yes serve .
```

Open `http://localhost:3000` and confirm, with the console open:

- Header shows the photo, name, headline, affiliation, and five links including CV.
- News lists four dated items, newest first, inside a scrollable block.
- Publications shows `2026` with two entries and `2025` with one; `Your Name` is bold in
  every entry; the Spotlight badge appears once.
- Projects shows three cards; the third has no image and does not leave a gap.
- Experience shows three entries, newest first, and the third has no logo.
- Awards shows Education, Awards, and Certifications sub-blocks in that order.
- No errors in the console.

- [ ] **Step 3: Verify the failure path**

```bash
mv data/news.json data/news.json.bak
```

Reload. Expected: the News section disappears entirely, the console shows one
`[render] hiding "news"` warning, and every other section still renders.

```bash
mv data/news.json.bak data/news.json
```

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "feat: render every résumé section from JSON"
```

---

### Task 9: Tag filter

**Files:**
- Create: `js/filter.js`
- Modify: `css/style.css` (filter and hidden-item styles)

`index.html` already loads `js/filter.js` — the tag was added in Task 7, where the
ordering constraint is explained. Do not add a second one.

**Interfaces:**
- Consumes: `collectTags` from `js/lib/collection.js`; `matchesTag` from `js/lib/tagfilter.js`; the `data:rendered` event and `data-tags` attributes from Task 8; the `.tag-filter` container from Task 7.
- Produces: no exports; a side effect that inserts buttons into `.tag-filter` and toggles `hidden` on `[data-tags]` nodes.

- [ ] **Step 1: Write `js/filter.js`**

```js
import { collectTags } from './lib/collection.js';
import { matchesTag } from './lib/tagfilter.js';

const ALL = null;
let activeTag = ALL;

function applyFilter() {
  for (const scope of ['#publications', '#projects']) {
    const section = document.querySelector(scope);
    if (!section) continue;

    const items = section.querySelectorAll('[data-tags]');
    let visible = 0;
    for (const item of items) {
      const tags = item.getAttribute('data-tags').split(' ').filter(Boolean);
      const show = matchesTag(tags, activeTag);
      item.toggleAttribute('hidden', !show);
      if (show) visible += 1;
    }

    // Year headings whose entries are all hidden would otherwise dangle.
    for (const heading of section.querySelectorAll('.year')) {
      const list = heading.nextElementSibling;
      const anyVisible = list?.querySelector('[data-tags]:not([hidden])');
      heading.toggleAttribute('hidden', !anyVisible);
    }

    let empty = section.querySelector('.empty-state');
    if (!empty) {
      empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing tagged this way here.';
      section.append(empty);
    }
    empty.toggleAttribute('hidden', visible > 0);
  }
}

function buildButtons(tags) {
  const host = document.querySelector('.tag-filter');
  if (!host) return;

  const makeButton = (label, value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-button';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(value === activeTag));
    button.addEventListener('click', () => {
      activeTag = activeTag === value ? ALL : value;
      for (const other of host.querySelectorAll('.tag-button')) {
        const otherValue = other.dataset.value === 'all' ? ALL : other.dataset.value;
        other.setAttribute('aria-pressed', String(otherValue === activeTag));
      }
      applyFilter();
    });
    button.dataset.value = value === ALL ? 'all' : value;
    return button;
  };

  host.append(makeButton('All', ALL));
  for (const tag of tags) host.append(makeButton(tag, tag));
}

document.addEventListener('data:rendered', (event) => {
  const { publications, projects } = event.detail;
  const tags = collectTags(publications, projects);
  if (tags.length === 0) return;
  buildButtons(tags);
  applyFilter();
});
```

- [ ] **Step 2: Add the filter styles to `css/style.css`**

Append:

```css
.tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.tag-button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.15rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.tag-button[aria-pressed="true"] {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--text);
  font-weight: 600;
}

.empty-state { color: var(--text-muted); font-size: 0.9rem; }
[hidden] { display: none !important; }
```

- [ ] **Step 3: Verify filtering**

Reload `http://localhost:3000`.

- The filter bar shows `All` plus four tags in alphabetical order:
  `data, efficiency, retrieval, systems`.
- Clicking `systems` leaves one publication (EuroSys) and one project (Campus Transit);
  the `2026` year heading disappears; Projects shows no empty state.
- Clicking `retrieval` shows one publication and one project.
- Clicking the active tag again returns to `All`.
- Tab reaches every button and Enter activates it.

- [ ] **Step 4: Commit**

```bash
git add js/filter.js css/style.css
git commit -m "feat: add shared topic filter for publications and projects"
```

---

### Task 10: Navigation, scroll spy, and theme toggle

**Files:**
- Create: `js/nav.js`
- Modify: `css/style.css` (smooth scroll and scroll-margin)

**Interfaces:**
- Consumes: the `.site-nav__list a`, `.theme-toggle`, and `section[id]` elements from Task 7.
- Produces: no exports. Sets `data-theme` on `<html>` and `aria-current` on nav links.

- [ ] **Step 1: Write `js/nav.js`**

```js
const STORAGE_KEY = 'theme';

/* ---------- theme ---------- */

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
  // aria-pressed must describe what is actually rendering, not what is stored.
  // With no explicit preference we deliberately leave data-theme absent so the CSS
  // media query keeps following the OS live — but the toggle must still announce
  // "dark" in that case, or a screen reader is told the opposite of what is on screen.
  const effective = (theme === 'light' || theme === 'dark')
    ? theme
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const toggle = document.querySelector('.theme-toggle');
  toggle?.setAttribute('aria-pressed', String(effective === 'dark'));
}

function currentTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

applyTheme(localStorage.getItem(STORAGE_KEY));

document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
});

/* ---------- scroll spy ---------- */

const links = new Map();
for (const link of document.querySelectorAll('.site-nav__list a')) {
  const id = link.getAttribute('href')?.replace('#', '');
  if (id) links.set(id, link);
}

function setCurrent(id) {
  for (const [key, link] of links) {
    if (key === id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}

const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
  if (visible.length > 0) setCurrent(visible[0].target.id);
}, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });

for (const id of links.keys()) {
  const section = document.getElementById(id);
  if (section) observer.observe(section);
}
```

Smooth scrolling is left to CSS (`scroll-behavior`) rather than a click handler, so it
honours a visitor's reduced-motion preference automatically.

- [ ] **Step 2: Add the scroll styles to `css/style.css`**

Append:

```css
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}

section[id] { scroll-margin-top: 4.5rem; }
```

- [ ] **Step 3: Verify**

Reload `http://localhost:3000`.

- Clicking a nav link scrolls smoothly and lands with the heading clear of the sticky bar.
- The nav link for the section on screen is bold; it updates while scrolling.
- The toggle flips the theme; the choice survives a reload.
- Clearing `localStorage` and switching the OS theme flips the page without a reload.
- With `prefers-reduced-motion: reduce` set in devtools, nav clicks jump instantly.

- [ ] **Step 4: Commit**

```bash
git add js/nav.js css/style.css
git commit -m "feat: add scroll spy, smooth scrolling, and theme toggle"
```

---

### Task 11: Section styling pass

**Files:**
- Modify: `css/style.css`

**Interfaces:**
- Consumes: the class names emitted by `js/render.js` in Task 8: `profile__photo`, `profile__text`, `profile__name`, `profile__headline`, `profile__affiliation`, `profile__links`, `news`, `news__date`, `year`, `pub-list`, `pub`, `pub__title`, `pub__authors`, `pub__meta`, `badge`, `chips`, `chip`, `chip--muted`, `card-grid`, `card`, `card__image`, `card__title`, `card__period`, `card__summary`, `card__bullets`, `stack`, `exp-list`, `exp`, `exp__logo`, `exp__body`, `exp__role`, `exp__org`, `exp__period`, `subhead`, `award-list`, `award__date`, `award__body`, `award__issuer`, `award__detail`.
- Produces: no new contract.

- [ ] **Step 1: Append the section styles to `css/style.css`**

```css
/* ---- Profile header ---- */

/* render.js mounts into .section-body, so that div — not <header> — is the flex row. */
.profile .section-body {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}
.profile__photo {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
  background: var(--bg-raised);
}
/* Flex child holding the header text. min-width:0 is load-bearing: without it a
   flex item's min-width resolves to its longest unbreakable token, so one long
   word in a name or affiliation overflows the page instead of wrapping. */
.profile__text { flex: 1; min-width: 0; }

.profile__name {
  font-family: var(--font-serif);
  font-size: 2rem;
  line-height: 1.15;
  margin: 0 0 0.25rem;
}
.profile__headline { margin: 0; }
.profile__affiliation { margin: 0; color: var(--text-muted); }
.profile__links { display: flex; flex-wrap: wrap; gap: 0.9rem; margin: 0.6rem 0 0; font-size: 0.9rem; }

/* ---- News ---- */

.news { margin: 0; padding: 0; list-style: none; }
.news li { display: flex; gap: 0.9rem; padding: 0.35rem 0; align-items: baseline; }
.news__date { flex: none; width: 5.5rem; color: var(--text-muted); font-size: 0.85rem; }

/* ---- Publications ---- */

.year {
  font-family: var(--font-serif);
  font-size: 1rem;
  color: var(--text-muted);
  margin: 1.5rem 0 0.5rem;
}
.pub-list { margin: 0; padding: 0; list-style: none; }
.pub {
  display: grid;
  gap: 0.15rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--border);
}
.pub__title { font-weight: 600; }
.pub__authors, .pub__meta { font-size: 0.9rem; color: var(--text-muted); }
.pub__authors strong { color: var(--text); }

.badge {
  margin-left: 0.5rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  background: var(--accent-soft);
  color: var(--text);
}

.chips { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.2rem; }
.chip {
  font-size: 0.78rem;
  padding: 0.05rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 3px;
  text-decoration: none;
}
.chip--muted { color: var(--text-muted); }

/* ---- Projects ---- */

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  background: var(--bg-raised);
}
.card__image {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 0.6rem;
  background: var(--bg);
}
.card__title { font-family: var(--font-serif); font-size: 1.05rem; margin: 0 0 0.15rem; }
.card__period { margin: 0; font-size: 0.82rem; color: var(--text-muted); }
.card__summary { margin: 0.4rem 0; }
.card__bullets { margin: 0.4rem 0; padding-left: 1.1rem; font-size: 0.9rem; }
.stack { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.5rem 0 0.3rem; }

/* ---- Experience ---- */

.exp-list { margin: 0; padding: 0; list-style: none; }
.exp { display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); }
.exp__logo { width: 44px; height: 44px; object-fit: contain; flex: none; border-radius: 4px; }
.exp__body { flex: 1; }
.exp__role { font-size: 1.02rem; margin: 0; }
.exp__org { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
.exp__period { margin: 0 0 0.4rem; color: var(--text-muted); font-size: 0.82rem; }
.exp__body ul { margin: 0.3rem 0 0; padding-left: 1.1rem; font-size: 0.93rem; }

/* ---- Awards ---- */

.subhead {
  font-family: var(--font-serif);
  font-size: 1rem;
  color: var(--text-muted);
  margin: 1.4rem 0 0.5rem;
}
.award-list { margin: 0; padding: 0; list-style: none; }
.award-list li { display: flex; gap: 0.9rem; padding: 0.35rem 0; align-items: baseline; }
.award__date { flex: none; width: 5.5rem; color: var(--text-muted); font-size: 0.85rem; }
.award__body { display: flex; flex-direction: column; }
.award__issuer, .award__detail { color: var(--text-muted); font-size: 0.86rem; }

/* ---- Responsive overrides ---- */

@media (max-width: 720px) {
  .profile .section-body { flex-direction: column; align-items: flex-start; text-align: left; }
  .profile__photo { width: 96px; height: 96px; }
  .card-grid { grid-template-columns: 1fr; }
  .news li, .award-list li { flex-direction: column; gap: 0.1rem; }
  .news__date, .award__date { width: auto; }
}
```

- [ ] **Step 2: Verify at three widths**

Reload and check at 1280px, 800px, and 375px (devtools device toolbar):

- Nothing overflows horizontally at any width.
- At 375px the profile stacks, cards go single-column, and dates sit above their text.
- Long publication titles wrap rather than pushing the link chips off-screen.
- Both themes keep body text and muted text legible against their backgrounds.

- [ ] **Step 3: Verify the print layout**

Open the browser print preview. Expected: no nav, no theme toggle, no filter bar; the
News block is fully expanded rather than scrolled; sections do not split awkwardly.

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: style every résumé section"
```

---

### Task 12: Self-hosted webfonts

**Files:**
- Create: `tools/fetch-fonts.js`
- Create: `assets/fonts/fonts.css`, `assets/fonts/*.woff2`
- Modify: `index.html` (link the font stylesheet)

**Interfaces:**
- Consumes: nothing in the repo.
- Produces: `assets/fonts/fonts.css` containing `@font-face` rules whose `src` URLs are
  relative filenames, so the page issues zero external requests. The families it defines
  are `Newsreader` and `Inter`, matching the `--font-serif` and `--font-sans` tokens
  already set in Task 7.

- [ ] **Step 1: Write `tools/fetch-fonts.js`**

```js
// One-shot helper: downloads the webfonts referenced by Google Fonts' CSS API and
// rewrites the stylesheet to point at local copies. Run it once; commit the output.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CSS_URL = 'https://fonts.googleapis.com/css2'
  + '?family=Newsreader:opsz,wght@6..72,400;6..72,600'
  + '&family=Inter:wght@400;600'
  + '&display=swap';

// Google serves woff2 only when the request looks like a modern browser.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

const cssResponse = await fetch(CSS_URL, { headers: { 'User-Agent': BROWSER_UA } });
if (!cssResponse.ok) throw new Error(`font CSS request failed: HTTP ${cssResponse.status}`);
let css = await cssResponse.text();

const urls = [...new Set([...css.matchAll(/https:\/\/[^)]+\.woff2/g)].map((match) => match[0]))];
if (urls.length === 0) throw new Error('no woff2 URLs found in the returned CSS');

await mkdir(outDir, { recursive: true });

for (const url of urls) {
  const filename = path.basename(new URL(url).pathname);
  const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } });
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  await writeFile(path.join(outDir, filename), Buffer.from(await response.arrayBuffer()));
  css = css.replaceAll(url, filename);
  console.log(`saved ${filename}`);
}

await writeFile(path.join(outDir, 'fonts.css'), css);
console.log(`wrote fonts.css with ${urls.length} face(s)`);
```

- [ ] **Step 2: Run it**

Run: `node tools/fetch-fonts.js`
Expected: several `saved *.woff2` lines and a final `wrote fonts.css`.

If this fails because the network is unavailable, skip to Step 5 and leave the page on
its system-font fallbacks — the design tokens in Task 7 already name them, so nothing
breaks. Do not add a font CDN link as a workaround; that would reintroduce an external
request.

- [ ] **Step 3: Link the stylesheet from `index.html`**

Insert immediately **before** the existing `css/style.css` link, so the `@font-face`
rules are known before the tokens that use them:

```html
<link rel="stylesheet" href="assets/fonts/fonts.css">
```

- [ ] **Step 4: Verify no external requests**

Reload with the devtools Network tab filtered to `Font`, then check the whole request
list. Expected: every request is same-origin; no `fonts.googleapis.com` or
`fonts.gstatic.com` entries. Headings should render in Newsreader.

- [ ] **Step 5: Commit**

```bash
git add tools/fetch-fonts.js assets/fonts index.html
git commit -m "feat: self-host webfonts so the page makes no external requests"
```

---

### Task 13: README and full-suite verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything built so far.
- Produces: the maintenance documentation referenced by spec §11.

- [ ] **Step 1: Write `README.md`**

````markdown
# Personal Site

Static résumé site. No build step, no dependencies.
Content lives in `data/*.json`; the page renders it at load time.

## Local preview

```bash
npx serve .
```

Then open <http://localhost:3000>.

**Opening `index.html` directly will not work.** The page fetches its JSON, and
browsers block `fetch` on `file://` URLs. Always use a local server.

## Adding an entry

Edit the matching file in `data/`, then run:

```bash
node tools/validate.js
```

Fix anything it reports, check the page in the browser, then commit and push.
GitHub Pages redeploys automatically.

### A publication

```json
{
  "title": "",
  "authors": ["Your Name", "A. Coauthor"],
  "me": "Your Name",
  "venue": "ICLR",
  "year": 2027,
  "type": "conference",
  "highlight": null,
  "tags": ["retrieval"],
  "links": { "paper": "", "code": "", "project": "" }
}
```

`type` is one of `conference`, `journal`, `preprint`, `patent`.
`me` must appear in `authors` — that is what gets bolded.

### A project

```json
{
  "title": "",
  "period": { "start": "2026-01", "end": null },
  "role": "",
  "summary": "",
  "description": ["", ""],
  "stack": [""],
  "tags": [""],
  "links": { "repo": "", "demo": "", "doc": "" },
  "image": "assets/img/your-image.svg"
}
```

`"end": null` renders as **Present**.

### An experience entry

```json
{
  "org": "",
  "logo": "assets/img/your-logo.svg",
  "role": "",
  "period": { "start": "2026-01", "end": null },
  "location": "",
  "bullets": [""],
  "tags": []
}
```

### An award, certification, or degree

```json
{
  "category": "award",
  "title": "",
  "issuer": "",
  "date": "2026-01",
  "detail": "",
  "url": null
}
```

`category` is one of `award`, `certification`, `education`.

### A news item

```json
{ "date": "2026-01", "text": "", "url": null }
```

## Conventions

- Dates are `"2026"` or `"2026-01"`. Nothing else validates.
- Array order does not matter for news, projects, experience, and awards — those are
  sorted by date at render time. **Publications are different:** they are grouped by
  year with the newest year first, but entries *within* the same year keep the order
  they have in the file (a publication carries only a year, so there is nothing finer
  to sort on). Arrange same-year papers the way you want them to appear.
- Leave a link empty (`""`) and it simply will not appear.
- Tags are collected automatically from the data; there is no tag list to maintain.
  The validator warns when two tags look like typos of each other.

## Tests

```bash
node --test
```

Covers the pure helpers in `js/lib/` and the validator. Rendering is verified by eye.

## Deploy

```bash
git push
```

The site is `https://<username>.github.io/`, served from the `main` branch root.
````

- [ ] **Step 2: Run the full test suite**

Run: `node --test`
Expected: PASS — all suites, 0 failures.

- [ ] **Step 3: Run the validator on the real data**

Run: `node tools/validate.js`
Expected: `OK - .../data passed all checks`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the content workflow and local preview"
```

---

### Task 14: Deploy to GitHub Pages

**Files:**
- No source changes. This task publishes what exists.

**Interfaces:**
- Consumes: the committed repository.
- Produces: a live site at `https://<username>.github.io/`.

- [ ] **Step 1: Confirm the GitHub account and derive the repo name**

```bash
gh auth status
gh api user --jq .login
```

Expected: an authenticated account and a username. The repository **must** be named
exactly `<username>.github.io` for User Pages to serve from the root.

If `gh auth status` fails, ask the user to run `gh auth login` themselves — it is
interactive and cannot be completed from a tool call.

- [ ] **Step 2: Create the repository and push**

```bash
USERNAME=$(gh api user --jq .login)
gh repo create "$USERNAME.github.io" --public --source=. --remote=origin --push
```

- [ ] **Step 3: Enable Pages on the root of `main`**

```bash
USERNAME=$(gh api user --jq .login)
gh api -X POST "repos/$USERNAME/$USERNAME.github.io/pages" \
  -f "source[branch]=main" -f "source[path]=/"
```

If this returns `409 Conflict`, Pages is already enabled — continue.

- [ ] **Step 4: Verify the deployment**

```bash
USERNAME=$(gh api user --jq .login)
gh api "repos/$USERNAME/$USERNAME.github.io/pages" --jq '.status, .html_url'
```

Wait until `status` is `built` (the first build takes a minute or two), then open the
returned URL and confirm:

- Every section renders with the placeholder content.
- The tag filter works.
- The theme toggle works and persists.
- Devtools shows no failed requests and no console errors.

- [ ] **Step 5: Record the live URL in the README**

```bash
USERNAME=$(gh api user --jq .login)
sed -i "1a\\
\\
Live at <https://$USERNAME.github.io/>." README.md
head -4 README.md
```

Expected: the README now reads `# Personal Site`, a blank line, then the live URL.

- [ ] **Step 6: Commit and push**

```bash
git add README.md
git commit -m "docs: record the live site URL"
git push
```

---

## Verification checklist

Run before declaring this plan complete:

- [ ] `node --test` passes with zero failures.
- [ ] `node tools/validate.js` exits 0 with no warnings.
- [ ] `node tools/validate.js tests/fixtures/broken/data` exits 1 and reports every one of rules 1–8.
- [ ] `package.json` has no `dependencies` or `devDependencies` key.
- [ ] Renaming any one file in `data/` hides only that section; the page still renders.
- [ ] The deployed URL loads with no console errors and no cross-origin requests.
- [ ] The page is legible and free of horizontal overflow at 375px, 800px, and 1280px, in both themes.
- [ ] Print preview drops the nav, toggle, and filter bar.

## What comes next

- **Plan 2 — Backend and stats:** Cloudflare Worker, D1 schema, `/api/hit`, `/api/stats`,
  the nightly cron, `js/beacon.js`, and `stats.html`. Spec §7.1–§7.5, §8, §12.
- **Plan 3 — Feed:** R2 storage, admin auth, `admin.html`, `feed.html`, and
  `tools/backup.js`. Spec §7.6–§7.8, §10.

Both extend this repository; neither changes anything built here except adding a nav
link and a `<script src="js/beacon.js">` tag to `index.html`.
