import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLeverJobs, formatLeverSalary, normalizeLeverJob } from '../scripts/leverClient.js';
import { leverCompanies } from '../scripts/leverCompanies.js';
import { mockFetch, silenceConsole } from './helpers.js';

assert.ok(leverCompanies.length >= 3, 'tests need at least 3 companies in the list');
const [target, failing, broken] = leverCompanies;
const daysAgo = (n) => Date.now() - n * 864e5;
const job = (over = {}) => ({
  text: 'Software Engineer',
  country: 'US',
  createdAt: daysAgo(1),
  ...over,
});

async function run(jobs, body = jobs) {
  const restoreFetch = mockFetch((url) => {
    if (url.includes(`/${target}?`)) return { body };
    if (url.includes(`/${failing}?`)) return { ok: false, status: 404 };
    if (url.includes(`/${broken}?`)) throw new Error('network down');
    return { body: [] };
  });
  const restoreConsole = silenceConsole();
  try {
    return await fetchLeverJobs({ daysAgo: 7 });
  } finally {
    restoreFetch();
    restoreConsole();
  }
}

test('fetchLeverJobs keeps recent US engineering jobs', async () => {
  const out = await run([job(), job({ text: 'Senior Backend Engineer', country: 'us' }), job({ createdAt: undefined })]);
  assert.equal(out.length, 3);
  assert.equal(out[0].companyName, target);
});

test('fetchLeverJobs filters by country, title and age', async () => {
  const out = await run([
    job({ country: 'GB' }),
    job({ country: undefined }),
    job({ text: 'Product Designer' }),
    job({ createdAt: daysAgo(30) }),
  ]);
  assert.equal(out.length, 0);
});

test('fetchLeverJobs survives failing companies and non-array responses', async () => {
  assert.equal((await run([], { error: 'not found' })).length, 0);
  assert.equal((await run([job()])).length, 1);
});

test('formatLeverSalary formats ranges by interval', () => {
  assert.equal(formatLeverSalary({ min: 186000, max: 223000, currency: 'USD', interval: 'per-year-salary' }), 'USD 186,000 – 223,000/yr');
  assert.equal(formatLeverSalary({ min: 35, max: 38, currency: 'CAD', interval: 'per-hour-wage' }), 'CAD 35 – 38/hr');
  assert.equal(formatLeverSalary({ min: 1, max: 2 }), '1 – 2');
});

test('formatLeverSalary falls back when there is no range', () => {
  assert.equal(formatLeverSalary(undefined), 'No compensation');
  assert.equal(formatLeverSalary({ currency: 'USD' }), 'No compensation');
});

test('normalizeLeverJob maps fields correctly', () => {
  const n = normalizeLeverJob({
    companyName: 'acme',
    job: {
      text: 'Software Engineer',
      createdAt: new Date('2026-10-01T00:00:00Z').getTime(),
      hostedUrl: 'https://jobs.lever.co/acme/1',
      categories: { location: 'San Francisco, CA' },
      salaryRange: { min: 140000, max: 180000, currency: 'USD', interval: 'per-year-salary' },
      workplaceType: 'remote',
    },
  });
  assert.equal(n.title, 'Software Engineer');
  assert.equal(n.company, 'acme');
  assert.equal(n.location, 'San Francisco, CA');
  assert.equal(n.salary, 'USD 140,000 – 180,000/yr');
  assert.equal(n.applyUrl, 'https://jobs.lever.co/acme/1');
  assert.equal(n.postedAt, '2026-10-01T00:00:00.000Z');
  assert.equal(n.jobType, 'Remote');
});

test('normalizeLeverJob falls back for missing fields', () => {
  const n = normalizeLeverJob({ companyName: 'acme', job: { text: 'Backend Engineer' } });
  assert.equal(n.location, 'Unknown');
  assert.equal(n.salary, 'Not specified');
  assert.equal(n.applyUrl, '#');
  assert.equal(n.postedAt, '');
  assert.equal(n.jobType, 'On-site / Hybrid');
});

test('normalizeLeverJob prefers categories.location over allLocations', () => {
  const n = normalizeLeverJob({
    companyName: 'acme',
    job: { text: 'T', categories: { allLocations: ['Austin, TX'] } },
  });
  assert.equal(n.location, 'Austin, TX');
});
