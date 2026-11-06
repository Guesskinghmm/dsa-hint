const test = require('node:test');
const assert = require('node:assert');
const { getPreviousHints, buildHintPrompt } = require('../popup.js');

test('Hint context collection - progressive hint levels', () => {
  const hintsStore = {
    1: 'Hint Level 1 text',
    2: 'Hint Level 2 text',
    3: 'Hint Level 3 text'
  };

  // Level 1 should have NO previous hints
  const l1Hints = getPreviousHints(1, hintsStore);
  assert.deepStrictEqual(l1Hints, []);

  // Level 2 should have Level 1
  const l2Hints = getPreviousHints(2, hintsStore);
  assert.deepStrictEqual(l2Hints, ['Hint Level 1 text']);

  // Level 3 should have Level 1 and Level 2
  const l3Hints = getPreviousHints(3, hintsStore);
  assert.deepStrictEqual(l3Hints, ['Hint Level 1 text', 'Hint Level 2 text']);
});

test('Hint prompt builder - constructs prompt with previous hints and rules', () => {
  const problem = {
    title: 'Two Sum',
    platform: 'leetcode',
    description: 'Find two numbers that add up to target',
    examples: 'Input: [2,7,11,15], target = 9 -> Output: [0,1]',
    language: 'Python3'
  };

  const previousHints = ['First hint: Consider using a hash map.'];
  const prompt = buildHintPrompt(problem, 2, previousHints);

  assert.ok(prompt.includes('Two Sum'));
  assert.ok(prompt.includes('leetcode'));
  assert.ok(prompt.includes('Find two numbers'));
  assert.ok(prompt.includes('Python3'));
  assert.ok(prompt.includes('First hint: Consider using a hash map.'));
  assert.ok(prompt.includes('Level 2 — Approach'));
  assert.ok(prompt.includes('DO NOT use LaTeX formatting'));
});

test('Hint prompt builder - works safely with missing fields', () => {
  const emptyProblem = {};
  const prompt = buildHintPrompt(emptyProblem, 1, []);

  assert.ok(prompt.includes('Unknown'));
  assert.ok(prompt.includes('Level 1 — Nudge'));
});
