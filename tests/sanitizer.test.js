const test = require('node:test');
const assert = require('node:assert');
const { MockDOMParser, MockNode } = require('./dom-mock.js');

// Set global DOMParser and Node for test
globalThis.DOMParser = MockDOMParser;
globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

const { sanitizeHtml } = require('../popup.js');

test('HTML Sanitizer - removes script and iframe tags completely', () => {
  const dirty = '<p>Safe intro</p><script>alert("xss")</script><iframe src="https://evil.com"></iframe><p>Safe outro</p>';
  const clean = sanitizeHtml(dirty);

  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('alert'));
  assert.ok(!clean.includes('<iframe'));
  assert.ok(clean.includes('<p>Safe intro</p>'));
  assert.ok(clean.includes('<p>Safe outro</p>'));
});

test('HTML Sanitizer - strips dangerous event handler attributes', () => {
  const dirty = '<p onclick="stealCookies()" onmouseover="alert(1)">Click me</p>';
  const clean = sanitizeHtml(dirty);

  assert.ok(!clean.includes('onclick'));
  assert.ok(!clean.includes('onmouseover'));
  assert.ok(!clean.includes('stealCookies'));
  assert.ok(clean.includes('Click me'));
});

test('HTML Sanitizer - strips javascript: and data: URLs on links', () => {
  const dirty = '<a href="javascript:alert(1)">Bad Link</a><a href="https://leetcode.com/problems/two-sum/">Good Link</a>';
  const clean = sanitizeHtml(dirty);

  assert.ok(!clean.includes('href="javascript:'));
  assert.ok(clean.includes('href="https://leetcode.com/problems/two-sum/"'));
  assert.ok(clean.includes('rel="noopener noreferrer"'));
  assert.ok(clean.includes('target="_blank"'));
});

test('HTML Sanitizer - preserves allowed formatting tags', () => {
  const input = '<p>Use a <strong>hash map</strong> with <code>O(1)</code> lookup. Key points:</p><ul><li>First item</li></ul>';
  const clean = sanitizeHtml(input);

  assert.ok(clean.includes('<strong>hash map</strong>'));
  assert.ok(clean.includes('<code>O(1)</code>'));
  assert.ok(clean.includes('<ul>'));
  assert.ok(clean.includes('<li>First item</li>'));
});
