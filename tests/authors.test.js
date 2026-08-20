import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAuthors } from '../js/lib/authors.js';

test('splitAuthors flags the owner among the authors', () => {
  const result = splitAuthors(['A. Kim', 'B. Lee'], 'A. Kim');
  assert.deepEqual(result, [
    { name: 'A. Kim', isSelf: true },
    { name: 'B. Lee', isSelf: false },
  ]);
});

test('splitAuthors ignores an equal-contribution asterisk when matching', () => {
  const result = splitAuthors(['A. Kim*', 'B. Lee'], 'A. Kim');
  assert.equal(result[0].isSelf, true);
  assert.equal(result[0].name, 'A. Kim*', 'the asterisk must survive into the rendered name');
});

test('splitAuthors matches case-insensitively and ignores surrounding space', () => {
  assert.equal(splitAuthors([' a. kim '], 'A. Kim')[0].isSelf, true);
});

test('splitAuthors flags nobody when me is missing', () => {
  const result = splitAuthors(['A. Kim', 'B. Lee'], '');
  assert.deepEqual(result.map((author) => author.isSelf), [false, false]);
});

test('splitAuthors returns an empty array for a missing author list', () => {
  assert.deepEqual(splitAuthors(undefined, 'A. Kim'), []);
});

test('splitAuthors yields no authors when the list is a string instead of an array', () => {
  // "authors": "T. Owner" is a plausible hand-edit; it must not throw and take the
  // whole publications section down with it.
  assert.deepEqual(splitAuthors('T. Owner', 'T. Owner'), []);
});
