# Personal Site — Design Spec

**Date:** 2026-08-15 (revised 2026-08-17)
**Status:** Approved (design), pending implementation plan

## 1. Purpose

A personal website with three faces:

1. **Résumé / archive** — a long-lived, single-page record of publications, projects,
   experience, and awards. Reference model: [rkdrn79.github.io](https://rkdrn79.github.io/).
2. **Feed** — an Instagram-like photo feed the owner posts to, including from a phone.
3. **Stats** — a visitor dashboard whose data accumulates over time.

The primary audience is general. The design goal is **low-friction accumulation**:
adding a résumé entry or a photo post a year from now must take under two minutes and
must not require remembering a build toolchain.

### Success criteria

1. Adding a publication/project/award = appending one object to one JSON file.
2. Posting a photo = drag, caption, submit — from a phone browser, under a minute.
3. A malformed entry breaks only its own section, never the whole page.
4. The résumé page still works with zero dependency updates five years from now.
5. The content model can be lifted into a different stack without rewriting the data.

### Non-goals

- Blog / long-form writing engine (feed posts are photo + caption)
- Comments, likes, follows, or any social graph
- Guestbook (considered and dropped)
- CMS beyond the single-purpose upload page
- Multi-language support (English only)
- Per-project detail pages with their own URLs

### Accepted trade-off

The feed and stats require a server, which breaks the original "no build, no
dependencies, no server" principle. After this revision there are **three things to
maintain**: the Pages repo, the Cloudflare Worker, and periodic backups. Success
criterion 4 applies to the résumé page only — the feed and stats depend on the
Cloudflare account staying alive. This was accepted knowingly.

## 2. Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Résumé stack | Vanilla HTML/CSS/JS + JSON data | No build step. Highest survival odds for an archive. |
| Language | English only | Widest reach; matches reference. |
| Site hosting | GitHub Pages (`<username>.github.io`, root of `main`) | Free, permanent, `git push` deploys. No Actions needed. |
| Backend | Cloudflare Workers + D1 + R2 | Keeps GitHub Pages decision intact; no idle sleep; data is exportable SQLite. |
| Layout | Sticky top nav + single centered column (max-width 820px) | Easiest responsive behavior, widest measure for long lists. |
| Résumé content | 6 JSON files under `data/` | Presentation/content separation; portable. |
| Feed content | D1 + R2, uploaded via admin page | Phone posting is the requirement that forces this. |
| Initial content | Realistic placeholder entries (2–3 per section) | Owner sees it working, then swaps values in. |

### Rejected alternatives

- **Astro** — best SEO, free per-item detail pages, but adds a build pipeline that can
  rot. Only worth it if long per-project writeups with their own URLs become firm.
- **Jekyll theme (al-folio etc.)** — fastest to something finished, but customization
  means fighting someone else's structure and coupling to upstream updates.
- **Supabase (direct-from-browser)** — would have removed the Worker layer, but the free
  tier pauses a project after ~1 week of inactivity and requires manual resume. For a
  site that may sit untouched for months, that is a failure condition.
- **Vercel (unify site + API + DB)** — one deploy for everything, but reverses the
  GitHub Pages decision and still needs an external DB.
- **GoatCounter + Giscus** — near-zero implementation, but Giscus requires visitors to
  hold a GitHub account, and the analytics dashboard cannot be rendered inside the site.

## 3. Architecture

### 3.1 Static site (GitHub Pages)

```
0P.Personal Web/
├─ index.html            # Résumé. Static skeleton + empty section containers
├─ feed.html             # Photo feed, loads from API
├─ stats.html            # Visitor dashboard, loads from API
├─ admin.html            # Upload page. <meta name="robots" content="noindex">
├─ css/style.css         # Design tokens (CSS custom properties) + layout + dark mode
├─ js/
│  ├─ render.js          # Résumé JSON -> DOM. One render function per section
│  ├─ filter.js          # Topic tag filter (Publications + Projects)
│  ├─ nav.js             # Smooth scroll + scroll spy + theme toggle
│  ├─ beacon.js          # POST /api/hit on every page
│  ├─ feed.js            # Feed rendering + carousel + lightbox
│  ├─ stats.js           # Dashboard rendering
│  └─ admin.js           # Login, client-side resize, upload
├─ data/                 # 6 résumé JSON files (see §4)
├─ assets/
│  ├─ img/               # Profile photo, org logos, project thumbnails
│  ├─ fonts/             # Self-hosted .woff2
│  └─ cv.pdf
├─ tools/
│  ├─ validate.js        # Résumé data validator (Node, no dependencies)
│  └─ backup.js          # Downloads all feed posts + images (Node, no dependencies)
├─ worker/               # Cloudflare Worker source (see §7)
│  ├─ src/index.js
│  ├─ schema.sql
│  └─ wrangler.toml
├─ backup/               # Local backup output (git-ignored)
├─ docs/superpowers/specs/
└─ README.md             # "How to add an entry" + "How to back up"
```

The résumé loads from **JSON files in the repo**; the feed and stats load from the
**API**. This split is deliberate: career history belongs in git history, and photos
need to be postable from a phone.

### 3.2 Résumé data flow

1. Page loads with a static skeleton already containing header text and empty
   `<section>` containers.
2. `render.js` fetches the six JSON files in parallel (`Promise.allSettled`).
3. Each section's render function receives its parsed array and returns a DOM fragment,
   mounted into that section's container.
4. `filter.js` collects the union of `tags` across publications and projects, builds
   the filter buttons, and toggles a class on already-rendered nodes. No re-render.
5. `nav.js` wires smooth scrolling, an `IntersectionObserver` scroll spy, and the theme
   toggle.

### 3.3 Module boundaries

Each résumé render function has the signature `(items: Array) => DocumentFragment` and
knows nothing about any other section. Removing a section means deleting one container
in `index.html` and one JSON file.

`filter.js` depends only on rendered DOM carrying `data-tags` attributes.

`beacon.js` is fire-and-forget: if the API is unreachable, nothing else is affected.

### 3.4 Error handling

- `Promise.allSettled`, not `Promise.all`: one failed fetch must not block the others.
- Missing or malformed JSON → that section is hidden (`hidden` attribute) and a
  `console.warn` names the file and the parse error. The rest of the page renders.
- An individual entry missing a required field → that entry is skipped with a
  `console.warn`; siblings still render.
- Missing optional values (`links.code`, `image`, `logo`, `highlight`) → the element is
  omitted from the markup.
- API unreachable → `feed.html` and `stats.html` show an inline "couldn't load" line,
  not a blank page. `index.html` is unaffected because it never calls the API for
  content.

### 3.5 Known constraint

`fetch()` on `file://` is blocked by CORS, so double-clicking `index.html` shows empty
sections. Local preview requires a static server (`npx serve .`). Documented in the
README; does not affect the deployed site.

## 4. Résumé content model

Shared conventions:

- Dates are strings: `"2026"` or `"2026-08"`. No `Date` objects, no timezones.
- `period.end: null` renders as `"Present"`.
- Sorting is the renderer's job (newest first). Array order in the JSON is irrelevant,
  **except within a publication year**: publications are grouped by year, and entries
  inside one year keep their file order (a publication carries only a year, so there
  is nothing finer to sort on).
- Empty-string or missing link values are omitted from the rendered output.
- Tag vocabulary is **derived** from the data, never maintained in a separate file.

```jsonc
// profile.json  (single object)
{
  "name": "",
  "headline": "",            // e.g. "M.S. Student in Computer Science"
  "affiliation": "",
  "email": "",
  "photo": "assets/img/profile.jpg",
  "cv": "assets/cv.pdf",
  "bio": "",                 // 2-4 sentences, plain text
  "links": [
    { "label": "GitHub", "url": "", "icon": "github" }
  ]
}

// news.json
[ { "date": "2026-08", "text": "", "url": null } ]

// publications.json
[ {
  "title": "",
  "authors": ["A. Kim*", "B. Lee"],
  "me": "A. Kim",                        // bolded within authors
  "venue": "ICLR",
  "year": 2026,
  "type": "conference",                  // conference | journal | preprint | patent
  "highlight": "Oral",                   // nullable
  "tags": [],
  "links": { "paper": "", "code": "", "project": "" }
} ]

// projects.json
[ {
  "title": "",
  "period": { "start": "2025-03", "end": null },
  "role": "",
  "summary": "",                         // one line, shown on the card
  "description": ["bullet", "bullet"],
  "stack": ["Python", "PyTorch"],
  "tags": [],
  "links": { "repo": "", "demo": "", "doc": "" },
  "image": "assets/img/proj-x.png"
} ]

// experience.json
[ {
  "org": "",
  "logo": "assets/img/logo-x.png",
  "role": "",
  "period": { "start": "", "end": null },
  "location": "",
  "bullets": [],
  "tags": []
} ]

// awards.json   — awards, certifications and education share one shape
[ {
  "category": "award",                   // award | certification | education
  "title": "",
  "issuer": "",
  "date": "",
  "detail": "",
  "url": null
} ]
```

**Required fields** (enforced by `validate.js`):

| File | Required |
| --- | --- |
| `profile.json` | `name`, `headline`, `affiliation`, `email`, `bio` |
| `news.json` | `date`, `text` |
| `publications.json` | `title`, `authors`, `me`, `venue`, `year`, `type` |
| `projects.json` | `title`, `period.start`, `summary` |
| `experience.json` | `org`, `role`, `period.start` |
| `awards.json` | `category`, `title`, `date` |

`awards.json` merges three categories into one file because all three share a
"when / what / from whom" shape; splitting them would triple the render code for no gain.

## 5. Page structure

Shared sticky nav across all pages: name (left), then the in-page section anchors for
whichever page is open, then the cross-page links (`Feed`, `Stats`, or `Résumé`), then
the theme toggle. On `index.html` the section anchors are About / News / Publications /
Projects / Experience / Awards; `feed.html` and `stats.html` have no section anchors and
show only the cross-page links.

### index.html — Résumé

1. **Header** — profile photo, name, headline, affiliation, email, social links, CV
2. **About** — bio paragraph
3. **News** — dated one-liners, newest first. All entries render; the block gets a
   `max-height` with `overflow-y: auto` so a long history does not push the page down.
   CSS only, no "show more" control.
4. **Publications** — tag filter bar, year group headings, then rows
   (title / authors with own name bolded / venue+year / link chips)
5. **Projects** — same tag filter state, 2-column card grid
6. **Experience** — org logo, role, org, period, location, bullets
7. **Awards & Education** — three labeled sub-blocks driven by `category`
8. **Footer** — email, CV link, last-updated year

The tag filter is a single shared state applied to both Publications and Projects.
Selecting a tag present in only one shows an empty-state line in the other rather than
a blank gap.

### feed.html — Photo feed

Single column of posts, newest first, 12 per page with a "load more" button
(cursor-based). Each post: image carousel (dots + swipe, 1–10 images), caption, date.
Clicking an image opens a lightbox with the full-size version. Images are lazy-loaded
with `width`/`height` attributes set from stored dimensions to prevent layout shift.

### stats.html — Visitor dashboard

- Two large numbers: **visitors today** and **total visitors**
- Total pageviews as a secondary figure
- **Referrers** — top 10 source hosts with counts
- **Countries** — top 10 country codes with counts, shown as a labeled bar list
- A one-line footnote stating how "total visitors" is defined (§8)

No time-series chart in this iteration.

### admin.html — Upload

Password field → token stored in `localStorage`. Then: file picker / drag zone
(multi-select, max 10), live thumbnails with remove buttons, caption textarea, submit.
Below the form, the 20 most recent posts with delete buttons. `noindex`.

## 6. Visual design

- **Typography**: serif (Newsreader or similar) for the name and section headings, sans
  for body and metadata. Self-hosted `.woff2` in `assets/fonts/` — no external font
  requests. Both stacks end in system fallbacks (`Georgia, serif` /
  `system-ui, sans-serif`) so the page degrades cleanly if a font file is missing.
- **Color**: neutral gray scale plus one accent used for links, the active tag, and the
  current nav section. Dark mode via CSS custom properties on `:root`, defaulting to
  `prefers-color-scheme` with a manual toggle persisted in `localStorage`.
- **Density**: optimized for scanning, not whitespace. Publications render as compact
  rows under year headings, because that list is expected to reach dozens of entries.
  Only Projects and the feed use cards, because they have images.
- **Interaction budget — five total**: tag filter, scroll spy, theme toggle, feed
  carousel, lightbox. No scroll-reveal animations.
- **Responsive**: single column below 720px; nav collapses to a horizontally scrollable
  chip row; project grid collapses to one column.
- **Accessibility**: semantic `<section>` + `<h2>` per section, filter buttons are real
  `<button>` elements with `aria-pressed`, nav uses `aria-current`, carousel is keyboard
  navigable, lightbox traps focus and closes on Escape, contrast ≥ 4.5:1 in both themes,
  visible focus rings.
- **Print**: `@media print` hides nav, theme toggle, and filter bar so `index.html`
  prints as a plain CV-like document.
- **Meta**: `og:image`, `og:description`, favicon, and a JSON-LD `Person` block so the
  owner's name and affiliation surface in search results.

## 7. Backend

Cloudflare Worker with a D1 database and an R2 bucket. Deployed with
`wrangler deploy` from `worker/`.

### 7.1 API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/hit` | none | Record a pageview |
| GET | `/api/stats` | none | Dashboard data, 60s edge cache |
| GET | `/api/posts?cursor=` | none | Feed page, 12 newest per call |
| GET | `/img/{key}` | none | R2 image proxy, `max-age=31536000, immutable` |
| POST | `/api/admin/login` | password | Returns a 7-day signed token |
| POST | `/api/admin/upload` | token | Accepts one resized image, returns its R2 key |
| POST | `/api/admin/post` | token | Creates a post from image keys + caption |
| DELETE | `/api/admin/post/{id}` | token | Deletes post row and its R2 objects |
| GET | `/api/admin/export` | token | Full JSON dump of posts for backup |

CORS: `Access-Control-Allow-Origin` is set to the configured Pages origin only.
Every other origin is rejected.

### 7.2 D1 schema

```sql
-- Raw pageviews. Pruned to 30 days by cron.
CREATE TABLE hits (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL,     -- ISO 8601 UTC
  day      TEXT NOT NULL,     -- YYYY-MM-DD in Asia/Seoul
  path     TEXT NOT NULL,
  visitor  TEXT NOT NULL,     -- daily anonymous hash
  country  TEXT,              -- ISO 3166-1 alpha-2
  ref_host TEXT               -- referrer hostname; NULL if direct or internal
);
CREATE INDEX idx_hits_day ON hits(day);

-- One row per (day, visitor) => "unique visitors today".
CREATE TABLE daily_visitors (
  day     TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (day, visitor)
);

-- Rolled up nightly. Survives hit pruning; this is the permanent record.
CREATE TABLE daily_stats (
  day       TEXT PRIMARY KEY,
  visitors  INTEGER NOT NULL,
  pageviews INTEGER NOT NULL
);

CREATE TABLE ref_totals     (host TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE country_totals (code TEXT PRIMARY KEY, count INTEGER NOT NULL);

CREATE TABLE posts (
  id         TEXT PRIMARY KEY,  -- e.g. 20260817-a1b2c3
  created_at TEXT NOT NULL,     -- ISO 8601 UTC
  caption    TEXT,
  images     TEXT NOT NULL      -- JSON: [{ key, thumb, w, h }]
);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

CREATE TABLE login_attempts (ip_hash TEXT NOT NULL, ts TEXT NOT NULL);
```

### 7.3 Hit recording

`POST /api/hit` body: `{ path, referrer }`. The Worker derives everything else from the
request. All writes go out as a single `db.batch()`:

1. `INSERT INTO hits`
2. `INSERT OR IGNORE INTO daily_visitors`
3. `INSERT ... ON CONFLICT DO UPDATE` on `ref_totals` (skipped when direct/internal)
4. `INSERT ... ON CONFLICT DO UPDATE` on `country_totals`

Rejected without writing: bot user agents (`/bot|crawl|spider|slurp|headless|preview|monitor/i`),
and repeats of the same `(visitor, path)` within 60 seconds — this stops refresh spam
from inflating pageviews.

### 7.4 Stats read

`GET /api/stats` returns:

```jsonc
{
  "today_visitors": 0,       // COUNT from daily_visitors WHERE day = today
  "total_visitors": 0,       // SUM(daily_stats.visitors) + today_visitors
  "total_pageviews": 0,      // SUM(daily_stats.pageviews) + today's hits
  "referrers": [ { "host": "", "count": 0 } ],   // top 10
  "countries": [ { "code": "", "count": 0 } ],   // top 10
  "since": "2026-08-17"
}
```

Cached at the edge for 60 seconds via the Cache API.

### 7.5 Nightly cron

A Cron Trigger runs once daily and, in order:

1. Rolls yesterday's `hits` and `daily_visitors` into a `daily_stats` row.
2. Deletes `daily_visitors` rows older than 2 days.
3. Deletes `hits` rows older than 30 days.
4. Deletes `login_attempts` older than 1 day.
5. Sweeps orphaned R2 objects: any `posts/{postId}/` prefix with no matching `posts`
   row and an upload older than 1 day (leftovers from an upload that failed midway).

`daily_stats`, `ref_totals`, and `country_totals` are never pruned — they are the
permanent record and stay small.

### 7.6 Feed upload

1. `admin.js` reads each selected file, draws it to a `<canvas>`, and exports two JPEGs:
   full (long edge 1600px, quality 0.82) and thumb (long edge 600px, quality 0.75).
   Uploading phone originals untouched would burn the R2 quota; a 5MB photo becomes
   roughly 250KB.
2. The client generates the `postId` (`YYYYMMDD-` + 6 random hex chars) **before**
   uploading and sends it with every image, so all blobs for one post share a prefix.
3. Each blob is POSTed to `/api/admin/upload`, which writes it to R2 under
   `posts/{postId}/{n}-{shorthash}.jpg` and returns the key. Content-addressed names
   make the 1-year immutable cache safe.
4. `/api/admin/post` writes the row with that same `postId`, the returned keys,
   dimensions, and caption.
5. Failure at any step leaves no post row; orphaned R2 objects are swept by the nightly
   cron (step 5 of §7.5).

### 7.7 Auth

- `ADMIN_PASSWORD`, `TOKEN_SECRET`, and `VISITOR_SALT` are Worker secrets
  (`wrangler secret put`), never in the repo.
- `/api/admin/login` compares the password in constant time, then returns
  `base64url(payload) + "." + base64url(HMAC-SHA256(payload, TOKEN_SECRET))` where
  the payload carries only an expiry (7 days).
- The client stores the token in `localStorage` and sends it as
  `Authorization: Bearer <token>`. No session table exists, so there is no session
  state to manage or leak.
- Failed logins are rate-limited to 5 per hour per hashed IP via `login_attempts`.
- Cookies are deliberately not used: the Pages origin and the Worker origin differ, and
  cross-site cookies are increasingly blocked by default.

### 7.8 Configuration

`wrangler.toml` binds `DB` (D1), `BUCKET` (R2), and a plain var `ALLOWED_ORIGIN`.
Everything secret is a Worker secret. `worker/README.md` lists the exact setup commands
so the backend can be recreated from scratch.

## 8. Privacy

- Visitors are identified by `SHA-256(IP + User-Agent + date + VISITOR_SALT)`, which is
  valid for **one day only**. Raw IP addresses are never stored.
- "Visitors today" = unique daily hashes for today, Asia/Seoul.
- **"Total visitors" = the sum of daily unique visitors.** The same person returning on
  a different day counts twice. Counting true lifetime uniques would require a
  permanent tracking identifier, which this design deliberately does not create. The
  dashboard states this definition in a footnote.
- Referrers are reduced to hostname; full URLs and query strings are discarded.
- Country comes from Cloudflare's request metadata; no geolocation lookup is performed.
- No cookies, no third-party analytics, no external requests of any kind from the pages.

## 9. Validation

`tools/validate.js` — plain Node, zero dependencies, run as `node tools/validate.js`.
Exits non-zero on any error. Covers the résumé JSON only (feed data is validated
server-side on write).

1. Each file parses as JSON and has the expected top-level type (object vs array).
2. Required fields present and non-empty (table in §4).
3. Dates match `^\d{4}(-\d{2})?$`; `period.end` is a valid date or `null`.
4. Non-empty link values start with `http://`, `https://`, `mailto:`, or `assets/`.
5. Local asset paths (`photo`, `cv`, `image`, `logo`) resolve to files on disk.
6. `me` appears in that entry's `authors` array (ignoring a trailing `*`).
7. `type` and `category` values are within their allowed sets.
8. **Warning, not error**: a tag within edit distance 1 of an existing tag (catches
   `vision` vs `visoin` before it fragments the filter).

Server-side, `/api/admin/post` enforces: 1–10 images, caption ≤ 2000 characters, each
uploaded blob ≤ 2MB and of type `image/jpeg`.

No browser test suite. For a site this size, the validator plus a look at `npx serve .`
is the appropriate level of verification.

## 10. Backup

Feed photos and captions live in Cloudflare, not in git. `node tools/backup.js` prompts
for the admin password, calls `/api/admin/export`, and writes:

```
backup/posts.json
backup/images/{postId}/{filename}.jpg
```

It skips files already present, so re-running is cheap. `backup/` is git-ignored by
default; committing it is the owner's choice.

**Running this occasionally is the only recurring chore this design creates.** It goes
at the top of the README, not the bottom.

## 11. Maintenance loop

Résumé:

```
edit data/*.json
node tools/validate.js
npx serve .              # visual check at http://localhost:3000
git commit && git push   # GitHub Pages redeploys automatically
```

Feed: open `admin.html`, log in, drag photos, submit. Nothing to deploy.

Backend changes: `cd worker && wrangler deploy`.

`README.md` contains copy-paste JSON snippets for each résumé entry type, the `file://`
caveat, the deploy steps, and the backup command. Its reader is the owner six months
from now.

## 12. Limits and cost

| Resource | Free tier | Practical ceiling for this site |
| --- | --- | --- |
| Workers requests | 100,000 / day | ~2,500–5,000 visits/day (20–40 requests per visit, mostly images) |
| D1 writes | 100,000 / day | ~25,000 pageviews/day (4 writes per hit) |
| D1 storage | 5 GB | Aggregated tables stay in the megabytes |
| R2 storage | 10 GB | ~40,000 photos at 250KB after resize |
| R2 Class A ops | 1M / month | Uploads only |

None of these are reachable at personal-site traffic. The binding constraint is D1
writes at roughly 25,000 pageviews per day, which would require sustained front-page
attention on a major aggregator.

Free-tier overage results in **requests being blocked, not billed**, so there is no
runaway-cost risk.

## 13. Out of scope for this iteration

- Real biographical content (site ships with placeholder entries; owner swaps values in)
- Custom domain (add a `CNAME` file, and optionally move R2 behind it to bypass the
  image proxy entirely)
- Per-project detail pages
- Time-series visitor chart
- Third-party analytics
