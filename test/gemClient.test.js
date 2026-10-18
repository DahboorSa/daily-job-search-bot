import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGemJobs } from '../scripts/gemClient.js';
import { gemCompanies } from '../scripts/gemCompanies.js';
import { mockFetch, silenceConsole } from './helpers.js';

assert.ok(gemCompanies.length >= 3, 'tests need at least 3 companies in the list');
const [target, failing, broken] = gemCompanies;
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const job = (over = {}) => ({
  title: 'Software Engineer',
  first_published_at: daysAgo(1),
  location: { name: 'New York, United States' },
  absolute_url: 'https://jobs.gem.com/x/1',
  ...over,
});

async function run(jobs, body = jobs) {
  const restoreFetch = mockFetch((url) => {
    if (url.includes(`/${target}/`)) return { body };
    if (url.includes(`/${failing}/`)) return { ok: false, status: 404 };
    if (url.includes(`/${broken}/`)) throw new Error('network down');
    return { body: [] };
  });
  const restoreConsole = silenceConsole();
  try {
    return await fetchGemJobs({ daysAgo: 7 });
  } finally {
    restoreFetch();
    restoreConsole();
  }
}

test('fetchGemJobs keeps recent US engineering jobs', async () => {
  const out = await run([
    job(),
    job({ title: 'Senior Backend Engineer', location: { name: 'San Francisco, CA' } }),
    job({ first_published_at: undefined }),
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[0].companyName, target);
});

test('fetchGemJobs filters by location, title and age', async () => {
  const out = await run([
    job({ location: { name: 'London, United Kingdom' } }),
    job({ location: undefined }),
    job({ title: 'Senior Product Designer' }),
    job({ first_published_at: daysAgo(30) }),
  ]);
  assert.equal(out.length, 0);
});

test('fetchGemJobs survives failing companies and non-array responses', async () => {
  assert.equal((await run([], { code: 404 })).length, 0);
  assert.equal((await run([job()])).length, 1);
});
