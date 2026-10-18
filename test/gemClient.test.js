import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGemJobs, normalizeGemJob } from '../scripts/gemClient.js';
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

async function run(jobs, body = jobs, opts = { titleKeyword: ['software engineer', 'backend'] }) {
  const restoreFetch = mockFetch((url) => {
    if (url.includes(`/${target}/`)) return { body };
    if (url.includes(`/${failing}/`)) return { ok: false, status: 404 };
    if (url.includes(`/${broken}/`)) throw new Error('network down');
    return { body: [] };
  });
  const restoreConsole = silenceConsole();
  try {
    return await fetchGemJobs({ daysAgo: 7, ...opts });
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
  const out = await run(
    [
      job({ location: { name: 'London, United Kingdom' } }),
      job({ location: undefined }),
      job({ title: 'Senior Product Designer' }),
      job({ first_published_at: daysAgo(30) }),
    ],
    undefined,
    { titleKeyword: 'software engineer' },
  );
  assert.equal(out.length, 0);
});

test('fetchGemJobs survives failing companies and non-array responses', async () => {
  assert.equal((await run([], { code: 404 })).length, 0);
  assert.equal((await run([job()])).length, 1);
});

test('fetchGemJobs filters by titleKeyword when provided', async () => {
  const restoreFetch = mockFetch((url) => {
    if (url.includes(`/${target}/`)) return { body: [job(), job({ title: 'Frontend Engineer' }), job({ title: 'Product Manager' })] };
    return { body: [] };
  });
  const restoreConsole = silenceConsole();
  try {
    const out = await fetchGemJobs({ daysAgo: 7, titleKeyword: 'frontend' });
    assert.equal(out.length, 1);
    assert.equal(out[0].job.title, 'Frontend Engineer');
  } finally {
    restoreFetch();
    restoreConsole();
  }
});

test('normalizeGemJob maps fields correctly', () => {
  const n = normalizeGemJob({
    companyName: 'stripe',
    job: {
      title: 'Software Engineer',
      first_published_at: '2026-10-01T00:00:00Z',
      absolute_url: 'https://jobs.gem.com/stripe/1',
      location: { name: 'New York, NY' },
    },
  });
  assert.equal(n.title, 'Software Engineer');
  assert.equal(n.company, 'stripe');
  assert.equal(n.location, 'New York, NY');
  assert.equal(n.applyUrl, 'https://jobs.gem.com/stripe/1');
  assert.equal(n.postedAt, '2026-10-01T00:00:00Z');
  assert.equal(n.jobType, 'On-site / Hybrid');
});

test('normalizeGemJob falls back for missing fields', () => {
  const n = normalizeGemJob({ companyName: 'stripe', job: { title: 'Backend Engineer' } });
  assert.equal(n.location, 'Unknown');
  assert.equal(n.salary, 'Not specified');
  assert.equal(n.applyUrl, '#');
  assert.equal(n.postedAt, '');
  assert.equal(n.jobType, 'On-site / Hybrid');
});

test('normalizeGemJob detects remote jobs', () => {
  const n = normalizeGemJob({
    companyName: 'stripe',
    job: { title: 'Software Engineer', location: { name: 'Remote, United States' } },
  });
  assert.equal(n.jobType, 'Remote');
});
