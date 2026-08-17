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
    if (!link.url || !link.label) continue;
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
  for (const item of items) {
    if (!AWARD_CATEGORIES.has(item.category)) console.warn('[render] skipping award entry', item);
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
