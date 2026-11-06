const test = require('node:test');
const assert = require('node:assert');
const { MockNode } = require('./dom-mock.js');

// Mock document.createElement and getElementById
globalThis.document = {
  createElement: (tag) => new MockNode(1, tag),
  getElementById: () => null
};

const { buildSimilarProblemsDOM } = require('../popup.js');

test('Similar problems DOM - builds safe elements without innerHTML injection', () => {
  const modelResponse = {
    topics: ['Array', 'Hash Table'],
    problems: [
      {
        title: 'Two Sum II',
        difficulty: 'Medium',
        url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/',
        tags: ['Array', 'Two Pointers']
      },
      {
        title: 'Malicious Problem <script>alert(1)</script>',
        difficulty: 'Hard',
        url: 'javascript:alert(1)',
        tags: ['Hack']
      }
    ]
  };

  const container = buildSimilarProblemsDOM(modelResponse);

  // Check valid problem gets link
  const html = container.innerHTML;
  assert.ok(html.includes('href="https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/"'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('Two Sum II ↗'));

  // Check malicious problem link is rejected (not created as an <a> with javascript:)
  assert.ok(!html.includes('href="javascript:'));
  // And title is plain text
  assert.ok(html.includes('Malicious Problem &lt;script&gt;alert(1)&lt;/script&gt;') || html.includes('Malicious Problem <script>alert(1)</script>'));
});
