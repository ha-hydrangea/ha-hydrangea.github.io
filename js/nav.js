const STORAGE_KEY = 'theme';

/* ---------- theme ---------- */

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
  const toggle = document.querySelector('.theme-toggle');
  toggle?.setAttribute('aria-pressed', String(theme === 'dark'));
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
