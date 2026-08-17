import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatPeriod, dateSortKey } from '../js/lib/format.js';

test('formatDate renders year-month as an abbreviated month and year', () => {
  assert.equal(formatDate('2026-08'), 'Aug 2026');
  assert.equal(formatDate('2025-01'), 'Jan 2025');
  assert.equal(formatDate('2025-12'), 'Dec 2025');
});

test('formatDate passes a year-only value straight through', () => {
  assert.equal(formatDate('2026'), '2026');
});

test('formatDate returns an empty string for missing values', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(undefined), '');
  assert.equal(formatDate(null), '');
});

test('formatDate returns unrecognised input unchanged rather than throwing', () => {
  assert.equal(formatDate('summer 2026'), 'summer 2026');
  assert.equal(formatDate('2026-13'), '2026-13');
});

test('formatPeriod renders an open-ended period as Present', () => {
  assert.equal(formatPeriod({ start: '2025-03', end: null }), 'Mar 2025 – Present');
});

test('formatPeriod renders a closed period as a range', () => {
  assert.equal(formatPeriod({ start: '2024-06', end: '2024-12' }), 'Jun 2024 – Dec 2024');
});

test('formatPeriod collapses a range whose ends are identical', () => {
  assert.equal(formatPeriod({ start: '2025', end: '2025' }), '2025');
});

test('formatPeriod returns an empty string when there is no start', () => {
  assert.equal(formatPeriod(null), '');
  assert.equal(formatPeriod({ start: '', end: null }), '');
});

test('dateSortKey orders year-month values numerically, newest highest', () => {
  assert.equal(dateSortKey('2026-08'), 202608);
  assert.equal(dateSortKey('2026'), 202600);
  assert.ok(dateSortKey('2026-08') > dateSortKey('2026-07'));
  assert.ok(dateSortKey('2026-01') > dateSortKey('2025-12'));
});

test('dateSortKey sorts unparseable values last', () => {
  assert.equal(dateSortKey('nope'), -1);
  assert.equal(dateSortKey(undefined), -1);
});
