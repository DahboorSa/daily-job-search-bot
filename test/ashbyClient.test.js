import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAshbyJobs, normalizeAshbyJob } from '../scripts/ashbyClient.js';
import { ashbyCompanies } from '../scripts/ashbyCompanies.js';
import { mockFetch, silenceConsole } from './helpers.js';

assert.ok(ashbyCompanies.length >= 3, 'tests need at least 3 companies in the list');
const [target, failing, broken] = ashbyCompanies;
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const job = (over = {}) => ({
  title: 'Software Engineer',
  location: 'Remote - US',
  department: 'Engineering',
  publishedAt: daysAgo(1),
  ...over,
});

async function run(jobs, opts) {
  const restoreFetch = mockFetch((url) => {
    if (url.includes(`/${target}?`)) return { body: { jobs } };
    if (url.includes(`/${failing}?`)) return { ok: false, status: 500 };
    if (url.includes(`/${broken}?`)) throw new Error('network down');
    return { body: { jobs: [] } };
  });
  const restoreConsole = silenceConsole();
  try {
    return await fetchAshbyJobs(opts);
  } finally {
    restoreFetch();
    restoreConsole();
  }
}

test('fetchAshbyJobs keeps recent US engineering jobs', async () => {
  const out = await run([job(), job({ title: 'Backend Developer' })]);
  assert.equal(out.length, 2);
  assert.equal(out[0].companyName, target);
});

test('fetchAshbyJobs filters by title, department, location and age', async () => {
  const out = await run([
    job({ title: 'Product Designer' }),
    job({ department: 'Sales', team: 'Sales' }),
    job({ location: 'Berlin' }),
    job({ publishedAt: daysAgo(30) }),
  ]);
  assert.equal(out.length, 0);
});

test('fetchAshbyJobs keeps jobs with no publish date and survives bad companies', async () => {
  const out = await run([job({ publishedAt: undefined })], { daysAgo: 7 });
  assert.equal(out.length, 1);
});

test('normalizeAshbyJob maps fields and salary floor', () => {
  const n = normalizeAshbyJob({
    companyName: 'acme',
    job: job({
      isRemote: true,
      applyUrl: 'https://x.test/apply',
      descriptionPlain: 'desc',
      compensation: {
        compensationTierSummary: '$100K – $150K',
        summaryComponents: [
          { compensationType: 'Salary', currencyCode: 'USD', interval: '1 YEAR', minValue: 100000 },
        ],
      },
    }),
  });
  assert.equal(n.company, 'acme');
  assert.equal(n.jobType, 'Remote');
  assert.equal(n.salary, '$100K – $150K');
  assert.equal(n.salaryMin, 100000);
  assert.equal(n.applyUrl, 'https://x.test/apply');
});

test('normalizeAshbyJob falls back for missing fields', () => {
  const n = normalizeAshbyJob({ companyName: 'acme', job: { title: 'T' } });
  assert.equal(n.location, 'Unknown');
  assert.equal(n.salary, 'Not specified');
  assert.equal(n.salaryMin, undefined);
  assert.equal(n.applyUrl, '#');
  assert.equal(n.postedAt, '');
  assert.equal(n.jobType, 'On-site / Hybrid');
});
