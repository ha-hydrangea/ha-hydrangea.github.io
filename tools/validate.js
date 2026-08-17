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
