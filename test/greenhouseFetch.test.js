import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGreenhouseJobs } from '../scripts/greenhouseClient.js';
import { greenhouseCompanies } from '../scripts/greenhouseCompanies.js';
import { mockFetch, silenceConsole } from './helpers.js';

assert.ok(greenhouseCompanies.length >= 3, 'tests need at least 3 companies in the list');
const [target, failing, broken] = greenhouseCompanies;
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const job = (over = {}) => ({
  title: 'Software Engineer',
  location: { name: 'Seattle, WA' },
  departments: [{ name: 'Engineering' }],
  first_published: daysAgo(1),
  ...over,
});

async function run(jobs) {
  const restoreFetch = mockFetch((url) => {
    if (url.includes(`/${target}/jobs`)) return { body: { jobs } };
    if (url.includes(`/${failing}/jobs`)) return { ok: false, status: 404 };
    if (url.includes(`/${broken}/jobs`)) throw new Error('network down');
    return { body: { jobs: [] } };
  });
  const restoreConsole = silenceConsole();
  try {
    return await fetchGreenhouseJobs({ daysAgo: 7 });
  } finally {
    restoreFetch();
    restoreConsole();
  }
}

test('fetchGreenhouseJobs keeps recent US engineering jobs', async () => {
  const out = await run([
    job(),
    job({ title: 'Backend Engineer', location: { name: 'United States' } }),
    job({ departments: [], first_published: undefined }),
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[0].companyName, target);
});

test('fetchGreenhouseJobs filters by location, title, department and age', async () => {
  const out = await run([
    job({ location: { name: 'London, UK' } }),
    job({ location: undefined }),
    job({ title: 'Account Executive' }),
    job({ departments: [{ name: 'Sales' }] }),
    job({ first_published: daysAgo(30) }),
  ]);
  assert.equal(out.length, 0);
});

test('fetchGreenhouseJobs uses department metadata when departments are missing', async () => {
  const out = await run([
    job({ departments: [], metadata: [{ name: 'Division', value: 'Engineering' }] }),
    job({ departments: [], metadata: [{ name: 'Division', value: 'Marketing' }] }),
  ]);
  assert.equal(out.length, 1);
});
