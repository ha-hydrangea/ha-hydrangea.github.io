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

/**
 * Array-valued fields are hand-edited JSON, so a scalar can turn up where a list
 * belongs. Iterating a string would emit one node per character and calling .join
 * on it would throw and cost the whole section; treat anything else as no items.
 */
function asArray(value) {
  return Array.isArray(value) ? value : [];
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
  return asArray(item.tags).join(' ');
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
      attrs: { src: profile.photo, alt: '', width: '640', height: '800' },
    }));
  }
  const body = el('div', { className: 'profile__text' });
  body.append(el('h1', { className: 'profile__name', text: profile.name }));
  body.append(el('p', { className: 'profile__headline', text: profile.headline }));
  body.append(el('p', { className: 'profile__affiliation', text: profile.affiliation }));

  const links = el('p', { className: 'profile__links' });
  for (const link of asArray(profile.links)) {
    if (!link.url || !link.label) continue;
    links.append(el('a', { text: link.label, attrs: { href: link.url, rel: 'noopener' } }));
  }
  if (profile.cv) links.append(el('a', { text: 'CV', attrs: { href: profile.cv } }));
  body.append(links);

  frag.append(body);
  return frag;
}

/** The footer contact line. Same source as the header, so the two cannot disagree. */
function renderFooter(profile) {
  const line = el('p');
  if (profile.email) {
    line.append(el('a', { text: profile.email, attrs: { href: `mailto:${profile.email}` } }));
  }
  if (profile.cv) {
    if (line.childNodes.length > 0) line.append(document.createTextNode(' · '));
    line.append(el('a', { text: 'CV', attrs: { href: profile.cv } }));
  }
  const frag = document.createDocumentFragment();
  frag.append(line);
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

/** The validator's required list for publications.json, enforced again at render time. */
function usablePublication(pub) {
  const ok = pub.title && asArray(pub.authors).length > 0
    && pub.me && pub.venue && pub.year && pub.type;
  if (!ok) console.warn('[render] skipping publication', pub);
  return Boolean(ok);
}

function renderPublications(items) {
  const frag = document.createDocumentFragment();
  // Filtered before grouping, not inside the loop: a publication with no year would
  // otherwise open a bucket keyed NaN and print a literal "NaN" year heading.
  for (const group of groupPublicationsByYear(items.filter(usablePublication))) {
    frag.append(el('h3', { className: 'year', text: String(group.year) }));
    const list = el('ul', { className: 'pub-list' });
    for (const pub of group.items) {
      const row = el('li', { className: 'pub' });
      // Set directly, not through el()'s attrs: el() skips empty values (correct for
      // href), but an untagged entry with no data-tags is invisible to filter.js and
      // would stay on screen under every filter while the counter ignored it.
      row.dataset.tags = tagAttr(pub);
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
    if (!project.title || !project.period?.start || !project.summary) {
      console.warn('[render] skipping project', project); continue;
    }
    const card = el('article', { className: 'card' });
    card.dataset.tags = tagAttr(project);   // unconditional — see renderPublications
    if (project.image) {
      card.append(el('img', {
        className: 'card__image',
        attrs: { src: project.image, alt: '', loading: 'lazy', width: '400', height: '400' },
      }));
    }
    card.append(el('h3', { className: 'card__title', text: project.title }));
    card.append(el('p', { className: 'card__period', text: formatPeriod(project.period) }));
    if (project.role) card.append(el('p', { className: 'card__role', text: project.role }));
    card.append(el('p', { className: 'card__summary', text: project.summary }));

    const description = asArray(project.description);
    if (description.length > 0) {
      const bullets = el('ul', { className: 'card__bullets' });
      for (const line of description) bullets.append(el('li', { text: line }));
      card.append(bullets);
    }

    const stack = el('p', { className: 'stack' });
    for (const item of asArray(project.stack)) stack.append(el('span', { className: 'chip chip--muted', text: item }));
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
    if (!job.org || !job.role || !job.period?.start) {
      console.warn('[render] skipping experience entry', job); continue;
    }
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
    const lines = asArray(job.bullets);
    if (lines.length > 0) {
      const bullets = el('ul');
      for (const line of lines) bullets.append(el('li', { text: line }));
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

/** The validator's required list for awards.json, enforced again at render time. */
function usableAward(item) {
  const ok = AWARD_CATEGORIES.has(item.category) && item.title && item.date;
  if (!ok) console.warn('[render] skipping award entry', item);
  return Boolean(ok);
}

function renderAwards(items) {
  const frag = document.createDocumentFragment();
  const usable = items.filter(usableAward);
  for (const [category, heading] of AWARD_GROUPS) {
    const inGroup = sortByDateDesc(
      usable.filter((item) => item.category === category),
      (entry) => entry.date,
    );
    if (inGroup.length === 0) continue;
    frag.append(el('h3', { className: 'subhead', text: heading }));
    const list = el('ul', { className: 'award-list' });
    for (const item of inGroup) {
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

/**
 * The chrome outside the section mounts: the browser tab and the nav's name link.
 * The static values in index.html stay as they are — crawlers and link-preview
 * scrapers do not reliably run JavaScript — so README documents them as manual.
 */
function applyChrome(profile) {
  if (!profile?.name) return;
  document.title = profile.name;
  const navName = document.querySelector('.site-nav__name');
  if (navName) navName.textContent = profile.name;
}

function renderAll(data) {
  applyChrome(data.profile);

  const sections = [
    ['header', data.profile, renderHeader],
    ['about', data.profile, renderAbout],
    ['news', data.news, renderNews],
    ['publications', data.publications, renderPublications],
    ['projects', data.projects, renderProjects],
    ['experience', data.experience, renderExperience],
    ['awards', data.awards, renderAwards],
    // The footer mount has no <section>/<header> ancestor, so a failure here leaves
    // the contact line empty and warns; the static "Last updated" line survives.
    ['footer', data.profile, renderFooter],
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
