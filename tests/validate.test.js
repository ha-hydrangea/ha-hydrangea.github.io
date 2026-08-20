import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../tools/validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const validDir = path.join(here, 'fixtures', 'valid', 'data');
const brokenDir = path.join(here, 'fixtures', 'broken', 'data');

function joined(list) {
  return list.join('\n');
}

test('a well-formed data directory produces no errors and no warnings', async () => {
  const result = await validate(validDir);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test('rule 1: a file with the wrong top-level type is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /awards\.json.*expected an array/i);
});

test('rule 2: an empty required field is an error naming the file and field', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /profile\.json.*bio/i);
});

test('rule 3: a date outside YYYY or YYYY-MM is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /news\.json.*date.*August 2026/i);
});

test('rule 4: a link without a recognised scheme is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /profile\.json.*github\.com\/example/i);
});

test('rule 5: an asset path that does not resolve on disk is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /profile\.json.*assets\/img\/missing\.png/i);
});

test('rule 6: me missing from the author list is an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /publications\.json.*T\. Owner.*authors/i);
});

test('rule 7: a value outside an enum is an error listing the allowed values', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /publications\.json.*blogpost.*conference/i);
});

test('rule 8: near-identical tags are a warning, not an error', async () => {
  const result = await validate(brokenDir);
  assert.match(joined(result.warnings), /vis[oi]{2}n.*vis[oi]{2}n/i);
  assert.equal(
    result.errors.some((line) => /visoin/i.test(line)),
    false,
    'a tag typo must never block a commit',
  );
});

test('a missing data file is reported as an error rather than throwing', async () => {
  const result = await validate(path.join(here, 'fixtures', 'nonexistent'));
  assert.equal(result.errors.length > 0, true);
  assert.match(joined(result.errors), /profile\.json/);
});

test('assetExists can be injected so callers control disk access', async () => {
  const seen = [];
  const result = await validate(validDir, {
    assetExists: async (relativePath) => {
      seen.push(relativePath);
      return true;
    },
  });
  assert.deepEqual(result.errors, []);
  assert.ok(seen.includes('assets/cv.pdf'));
});

test('rule 9: a string where an array belongs is an error naming the field and the value', async () => {
  const result = await validate(brokenDir);
  assert.match(
    joined(result.errors),
    /publications\.json entry 1: "authors" must be an array, got string "T\. Owner"/,
  );
  assert.match(
    joined(result.errors),
    /publications\.json entry 1: "tags" must be an array, got string "vision"/,
  );
});

test('rule 9 applies per file, not only to publications', async () => {
  const result = await validate(brokenDir);
  assert.match(
    joined(result.errors),
    /projects\.json entry 0: "description" must be an array, got string "Did a thing\."/,
  );
});

test('a non-array authors is reported instead of throwing, and the run continues', async () => {
  // Reaching an assertion at all is the regression test: this used to raise
  // "(entry.authors ?? []).map is not a function" and abandon every later file.
  const result = await validate(brokenDir);
  assert.match(joined(result.errors), /publications\.json entry 1: "authors" must be an array/);
  assert.match(
    joined(result.errors),
    /awards\.json/,
    'files after publications.json must still be checked',
  );
});

test('one wrong-typed authors produces one error, not a spurious "me" mismatch too', async () => {
  const result = await validate(brokenDir);
  const mismatches = result.errors.filter((line) => /does not appear in authors/.test(line));
  assert.deepEqual(mismatches, [
    'publications.json entry 0: me "T. Owner" does not appear in authors',
  ]);
});

test('rule 10: an assets/ path in a link field is checked on disk, not just asset fields', async () => {
  const result = await validate(brokenDir);
  assert.match(
    joined(result.errors),
    /publications\.json entry 1: asset "assets\/missing-paper\.pdf" does not exist on disk/,
  );
});

test('an asset field is reported once, not twice, now that links are checked too', async () => {
  const result = await validate(brokenDir);
  const missing = result.errors.filter((line) => /assets\/img\/missing\.png/.test(line));
  assert.equal(missing.length, 1, missing.join('\n'));
});
