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
