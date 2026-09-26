import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSmartRecruitersJobs, smartRecruitersJobUrl } from '../scripts/smartRecruitersClient.js';
import { smartRecruitersCompanies } from '../scripts/smartRecruitersCompanies.js';
import { mockFetch, silenceConsole } from './helpers.js';

assert.ok(smartRecruitersCompanies.length >= 3, 'tests need at least 3 companies in the list');
const [target, failing, broken] = smartRecruitersCompanies;
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const job = (over = {}) => ({
  id: '600',
  name: 'Software Engineer',
  releasedDate: daysAgo(1),
  location: { country: 'us', fullLocation: 'Austin, TX, United States' },
  ...over,
});

async function run(handleTarget) {
  const urls = [];
  const restoreFetch = mockFetch((url) => {
    urls.push(url);
    if (url.includes(`/${target}/`)) return handleTarget(url);
    if (url.includes(`/${failing}/`)) return { ok: false, status: 500 };
    if (url.includes(`/${broken}/`)) throw new Error('network down');
    return { body: { totalFound: 0, content: [] } };
  });
  const restoreConsole = silenceConsole();
  try {
    return { out: await fetchSmartRecruitersJobs({ daysAgo: 7 }), urls };
  } finally {
    restoreFetch();
    restoreConsole();
  }
}
const page = (content) => () => ({ body: { totalFound: content.length, content } });

test('fetchSmartRecruitersJobs keeps recent US engineering jobs', async () => {
  const { out, urls } = await run(
    page([job(), job({ name: 'Senior Backend Engineer', location: { country: 'US' } }), job({ releasedDate: undefined })]),
  );
  assert.equal(out.length, 3);
  assert.equal(out[0].companyName, target);
  assert.ok(urls.some((u) => u.includes(`/${target}/postings?country=us`)));
});

test('fetchSmartRecruitersJobs filters by country, title and age', async () => {
  const { out } = await run(
    page([
      job({ location: { country: 'gb' } }),
      job({ location: undefined }),
      job({ name: 'Account Executive' }),
      job({ releasedDate: daysAgo(30) }),
    ]),
  );
  assert.equal(out.length, 0);
});

test('fetchSmartRecruitersJobs follows pagination until totalFound', async () => {
  const { out, urls } = await run((url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    const count = offset === 0 ? 100 : 5;
    return { body: { totalFound: 105, content: Array.from({ length: count }, () => job()) } };
  });
  assert.equal(out.length, 105);
  assert.equal(urls.filter((u) => u.includes(`/${target}/`)).length, 2);
});

test('fetchSmartRecruitersJobs survives failing companies and malformed responses', async () => {
  assert.equal((await run(() => ({ body: { error: 'nope' } }))).out.length, 0);
  assert.equal((await run(page([job()]))).out.length, 1);
});

test('smartRecruitersJobUrl prefers the company identifier', () => {
  assert.equal(
    smartRecruitersJobUrl({ companyName: 'canva', job: { id: '1', company: { identifier: 'Canva' } } }),
    'https://jobs.smartrecruiters.com/Canva/1',
  );
  assert.equal(smartRecruitersJobUrl({ companyName: 'canva', job: { id: '1' } }), 'https://jobs.smartrecruiters.com/canva/1');
});
