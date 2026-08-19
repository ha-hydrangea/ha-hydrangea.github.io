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
