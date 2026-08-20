# Personal Site

Live at <https://ha-hydrangea.github.io/>

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
