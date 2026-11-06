const test = require('node:test');
const assert = require('node:assert');
const { normalizeResult } = require('../content.js');

test('Scraper normalization - exact normalized shape', () => {
  const result = normalizeResult(
    '  Solve Me First  ',
    'Complete the function solveMeFirst to compute the sum of two integers.',
    '2\n3\n---\n5',
    ' Python3 '
  );

  assert.deepStrictEqual(Object.keys(result).sort(), ['description', 'examples', 'language', 'title'].sort());
  assert.strictEqual(result.title, 'Solve Me First');
  assert.strictEqual(result.description, 'Complete the function solveMeFirst to compute the sum of two integers.');
  assert.strictEqual(result.examples, '2\n3\n---\n5');
  assert.strictEqual(result.language, 'Python3');
});

test('Scraper normalization - graceful handling of undefined / null', () => {
  const result = normalizeResult(null, undefined, null, undefined);

  assert.strictEqual(result.title, '');
  assert.strictEqual(result.description, '');
  assert.strictEqual(result.examples, '');
  assert.strictEqual(result.language, '');
});

test('Scraper normalization - bounds long descriptions and examples', () => {
  const longDesc = 'A'.repeat(5000);
  const longExamples = 'B'.repeat(3000);

  const result = normalizeResult('Long Problem', longDesc, longExamples, 'C++');

  assert.ok(result.description.length <= 3000);
  assert.strictEqual(result.description.length, 3000);
  assert.ok(result.examples.length <= 1500);
  assert.strictEqual(result.examples.length, 1500);
});
