import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTag } from '../js/lib/tagfilter.js';

test('matchesTag lets everything through when no tag is active', () => {
  assert.equal(matchesTag(['vision'], null), true);
  assert.equal(matchesTag([], null), true);
});

test('matchesTag keeps only items carrying the active tag', () => {
  assert.equal(matchesTag(['vision', 'nlp'], 'nlp'), true);
  assert.equal(matchesTag(['vision'], 'nlp'), false);
});

test('matchesTag treats a missing tags array as no tags', () => {
  assert.equal(matchesTag(undefined, 'nlp'), false);
  assert.equal(matchesTag(undefined, null), true);
});
