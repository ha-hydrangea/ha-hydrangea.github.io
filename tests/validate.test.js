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
