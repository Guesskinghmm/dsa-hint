const test = require('node:test');
const assert = require('node:assert');
const { isValidProblemUrl, ALLOWED_PROBLEM_HOSTS } = require('../popup.js');

test('URL validation - allowed problem hosts contain 4 platforms', () => {
  assert.ok(ALLOWED_PROBLEM_HOSTS.has('leetcode.com'));
  assert.ok(ALLOWED_PROBLEM_HOSTS.has('codeforces.com'));
  assert.ok(ALLOWED_PROBLEM_HOSTS.has('hackerrank.com'));
  assert.ok(ALLOWED_PROBLEM_HOSTS.has('codechef.com'));
});

test('URL validation - valid HTTPS problem URLs', () => {
  assert.strictEqual(isValidProblemUrl('https://leetcode.com/problems/3sum/'), true);
  assert.strictEqual(isValidProblemUrl('https://www.leetcode.com/problems/3sum/'), true);
  assert.strictEqual(isValidProblemUrl('https://codeforces.com/problemset/problem/1/A'), true);
  assert.strictEqual(isValidProblemUrl('https://www.hackerrank.com/challenges/solve-me-first/problem'), true);
  assert.strictEqual(isValidProblemUrl('https://www.codechef.com/problems/FLOW001'), true);
});

test('URL validation - rejects insecure HTTP protocol', () => {
  assert.strictEqual(isValidProblemUrl('http://leetcode.com/problems/3sum/'), false);
  assert.strictEqual(isValidProblemUrl('http://codeforces.com/problemset/problem/1/A'), false);
  assert.strictEqual(isValidProblemUrl('http://www.hackerrank.com/challenges/test'), false);
  assert.strictEqual(isValidProblemUrl('http://www.codechef.com/problems/FLOW001'), false);
});

test('URL validation - rejects dangerous schemes and unapproved hosts', () => {
  assert.strictEqual(isValidProblemUrl('javascript:alert(1)'), false);
  assert.strictEqual(isValidProblemUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.strictEqual(isValidProblemUrl('https://evil.com/problems/attack'), false);
  assert.strictEqual(isValidProblemUrl('https://leetcode.com.evil.com/problems/test'), false);
  assert.strictEqual(isValidProblemUrl('https://attacker-codeforces.com'), false);
  assert.strictEqual(isValidProblemUrl(''), false);
  assert.strictEqual(isValidProblemUrl(null), false);
  assert.strictEqual(isValidProblemUrl(undefined), false);
});
