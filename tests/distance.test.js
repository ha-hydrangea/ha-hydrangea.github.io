import test from 'node:test';
import assert from 'node:assert/strict';
import { editDistance } from '../js/lib/distance.js';

test('editDistance is zero for identical strings', () => {
  assert.equal(editDistance('vision', 'vision'), 0);
});

test('editDistance counts a single transposition as two edits', () => {
  assert.equal(editDistance('vision', 'visoin'), 2);
});

test('editDistance counts a single substitution, insertion, or deletion as one', () => {
  assert.equal(editDistance('vision', 'vosion'), 1);
  assert.equal(editDistance('vision', 'visionn'), 1);
  assert.equal(editDistance('vision', 'visin'), 1);
});

test('editDistance handles empty strings', () => {
  assert.equal(editDistance('', ''), 0);
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('abc', ''), 3);
});
