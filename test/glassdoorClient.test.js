import test from 'node:test';
import assert from 'node:assert/strict';
import { getGlassdoorData } from '../scripts/glassdoorClient.js';
import { mockFetch, silenceConsole } from './helpers.js';

async function withKey(key, handler, fn) {
  const saved = process.env.RAPIDAPI_KEY;
  if (key === undefined) delete process.env.RAPIDAPI_KEY;
  else process.env.RAPIDAPI_KEY = key;
  const restoreFetch = mockFetch(handler);
  const restoreConsole = silenceConsole();
  try {
    return await fn();
  } finally {
    restoreFetch();
    restoreConsole();
    if (saved === undefined) delete process.env.RAPIDAPI_KEY;
    else process.env.RAPIDAPI_KEY = saved;
  }
}

test('getGlassdoorData skips the request without an API key', async () => {
  let called = false;
  const out = await withKey(undefined, () => { called = true; return {}; }, () =>
    getGlassdoorData('Engineer', 'Austin, TX'));
  assert.deepEqual(out, { salaryRange: null });
  assert.equal(called, false);
});

test('getGlassdoorData formats the salary range', async () => {
  const out = await withKey('k', () => ({ body: { data: { min_salary: 100000.4, max_salary: 150000 } } }), () =>
    getGlassdoorData('Engineer', 'Austin, TX'));
  assert.deepEqual(out, { salaryRange: '$100,000 – $150,000/yr' });
});

test('getGlassdoorData returns null on missing data, HTTP errors and exceptions', async () => {
  const noData = await withKey('k', () => ({ body: { data: {} } }), () => getGlassdoorData('E', 'L'));
  const httpErr = await withKey('k', () => ({ ok: false, status: 429 }), () => getGlassdoorData('E', 'L'));
  const thrown = await withKey('k', () => { throw new Error('boom'); }, () => getGlassdoorData('E', 'L'));
  for (const out of [noData, httpErr, thrown]) assert.deepEqual(out, { salaryRange: null });
});
