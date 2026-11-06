const test = require('node:test');
const assert = require('node:assert');
const { parsePlatformFromUrl } = require('../popup.js');

test('Platform detection - LeetCode problem URLs', () => {
  const result = parsePlatformFromUrl('https://leetcode.com/problems/two-sum/');
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.platform, 'leetcode');
  assert.strictEqual(result.badge, 'LC');
  assert.strictEqual(result.theme, 'leetcode');
});

test('Platform detection - Codeforces problemset URLs', () => {
  const result = parsePlatformFromUrl('https://codeforces.com/problemset/problem/123/A');
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.platform, 'codeforces');
  assert.strictEqual(result.badge, 'CF');
  assert.strictEqual(result.theme, 'codeforces');
});

test('Platform detection - Codeforces contest & gym URLs', () => {
  const contestRes = parsePlatformFromUrl('https://codeforces.com/contest/1800/problem/D');
  assert.notStrictEqual(contestRes, null);
  assert.strictEqual(contestRes.platform, 'codeforces');
  assert.strictEqual(contestRes.badge, 'CF');

  const gymRes = parsePlatformFromUrl('https://codeforces.com/gym/102000/problem/A');
  assert.notStrictEqual(gymRes, null);
  assert.strictEqual(gymRes.platform, 'codeforces');
  assert.strictEqual(gymRes.badge, 'CF');
});

test('Platform detection - HackerRank challenge URLs', () => {
  const challengeRes = parsePlatformFromUrl('https://www.hackerrank.com/challenges/simple-array-sum/problem');
  assert.notStrictEqual(challengeRes, null);
  assert.strictEqual(challengeRes.platform, 'hackerrank');
  assert.strictEqual(challengeRes.badge, 'HR');
  assert.strictEqual(challengeRes.theme, 'hackerrank');

  const contestRes = parsePlatformFromUrl('https://www.hackerrank.com/contests/projecteuler/challenges/euler001');
  assert.notStrictEqual(contestRes, null);
  assert.strictEqual(contestRes.platform, 'hackerrank');
  assert.strictEqual(contestRes.badge, 'HR');
});

test('Platform detection - CodeChef problem URLs', () => {
  const probRes = parsePlatformFromUrl('https://www.codechef.com/problems/FLOW001');
  assert.notStrictEqual(probRes, null);
  assert.strictEqual(probRes.platform, 'codechef');
  assert.strictEqual(probRes.badge, 'CC');
  assert.strictEqual(probRes.theme, 'codechef');

  const contestProbRes = parsePlatformFromUrl('https://www.codechef.com/START123C/problems/P1');
  assert.notStrictEqual(contestProbRes, null);
  assert.strictEqual(contestProbRes.platform, 'codechef');
  assert.strictEqual(contestProbRes.badge, 'CC');
});

test('Platform detection - rejects unsupported URLs', () => {
  assert.strictEqual(parsePlatformFromUrl('https://github.com/Guesskinghmm/dsa-hint'), null);
  assert.strictEqual(parsePlatformFromUrl('https://leetcode.com/explore/'), null);
  assert.strictEqual(parsePlatformFromUrl('https://codeforces.com/profile/tourist'), null);
  assert.strictEqual(parsePlatformFromUrl('https://www.hackerrank.com/leaderboard'), null);
  assert.strictEqual(parsePlatformFromUrl('https://www.codechef.com/ratings'), null);
  assert.strictEqual(parsePlatformFromUrl(''), null);
  assert.strictEqual(parsePlatformFromUrl(null), null);
});
