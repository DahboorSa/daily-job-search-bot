import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTitleMatch } from '../scripts/jobDefaults.js';

test('buildTitleMatch with a string matches substring case-insensitively', () => {
  const match = buildTitleMatch('Backend');
  assert.equal(match('senior backend engineer'), true);
  assert.equal(match('backend developer'), true);
  assert.equal(match('frontend engineer'), false);
});

test('buildTitleMatch with an array matches any keyword (OR logic)', () => {
  const match = buildTitleMatch(['software engineer', 'backend']);
  assert.equal(match('software engineer'), true);
  assert.equal(match('senior backend engineer'), true);
  assert.equal(match('staff software engineer'), true);
  assert.equal(match('product designer'), false);
  assert.equal(match('account executive'), false);
});

test('buildTitleMatch array keywords are case-insensitive', () => {
  const match = buildTitleMatch(['Software Engineer', 'Backend']);
  assert.equal(match('software engineer'), true);
  assert.equal(match('backend developer'), true);
  assert.equal(match('product manager'), false);
});

test('buildTitleMatch throws for empty array', () => {
  assert.throws(() => buildTitleMatch([]), /titleKeyword is required/);
});

test('buildTitleMatch throws for undefined', () => {
  assert.throws(() => buildTitleMatch(undefined), /titleKeyword is required/);
});
