# Personal Site

Live at <https://ha-hydrangea.github.io/>

Static résumé site. No build step, no dependencies.
Content lives in `data/*.json`; the page renders it at load time.

## First-time setup

Almost everything on the page is rendered from `data/*.json`. Two things are not, and
both need editing by hand once.

### 1. The placeholders in `index.html`

The `<head>` and the JSON-LD block must stay static: search engines and link-preview
scrapers do not reliably run JavaScript, so this is the only machine-readable content
on the page. Replace every value below.

| Where in `index.html` | Placeholder to replace |
| --- | --- |
| `<title>` | `Your Name` |
| `<meta name="description">` | `Publications, projects, and experience of Your Name.` |
| `<meta property="og:title">` | `Your Name` |
| `<meta property="og:description">` | `Publications, projects, and experience of Your Name.` |
| `<meta property="og:image">` | `https://ha-hydrangea.github.io/assets/img/profile.jpg` |
| `<meta property="og:url">` | `https://ha-hydrangea.github.io/` |
| JSON-LD `"name"` | `Your Name` |
| JSON-LD `"affiliation"` → `"name"` | `Your University` |
| JSON-LD `"email"` | `mailto:you@example.com` |
| JSON-LD `"url"` | `https://ha-hydrangea.github.io/` |
| the footer's last line | `Last updated 2026` |

**`node tools/validate.js` does not read `index.html`.** It will report success with
every placeholder above still in place. Nothing else warns either. Check this list by
eye once, at setup.

The nav's name link, the browser tab title, and the footer contact line *are* filled in
from `profile.name`, `profile.email`, and `profile.cv` at load time — leave their markup
alone.

### 2. `data/profile.json`

```json
{
  "name": "",
  "headline": "",
  "affiliation": "",
  "email": "you@example.com",
  "photo": "assets/img/profile.jpg",
  "cv": "",
  "bio": "",
  "links": [
    { "label": "GitHub", "url": "https://github.com/yourname", "icon": "github" },
    { "label": "Email", "url": "mailto:you@example.com", "icon": "mail" }
  ]
}
```

`name`, `headline`, `affiliation`, `email`, and `bio` are required. `links` may be
empty; each entry needs a `label` and a `url`.

### Adding a CV

The repository ships without one. To add yours, drop the PDF at `assets/cv.pdf` and set
`"cv": "assets/cv.pdf"` in `data/profile.json`. While `cv` is `""` the header and footer
links are simply omitted, so there is never a dead link to a file that is not there.

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
  "bullets": [""]
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
  The validator warns when two tags look like typos of each other. Only publications
  and projects are filterable, so tags on other entry types have no effect.
- Two fields are stored but not displayed today: `type` on a publication (required, and
  useful if the list is ever split by kind) and `icon` on a profile link (kept for a
  future icon set). Filling them in changes nothing on the page.

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
