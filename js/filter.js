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
