import test from 'node:test';
import assert from 'node:assert/strict';
import { createGetJobs } from '../scripts/mcpJobsServer.js';

const job = (companyName, title = 'Software Engineer') => ({ companyName, job: { title } });

function makeSource(jobs) {
  return {
    name: 'TestBoard',
    csvColumns: ['companyName', 'title'],
    toCsvColumns: ({ companyName, job }) => ({ companyName, title: job.title }),
    fetchJobs: async () => jobs,
    defaultDaysAgo: 7,
    companiesCount: 5,
  };
}

test('createGetJobs returns all results when no company filter', async () => {
  const getJobs = createGetJobs(makeSource([job('acme'), job('stripe'), job('notion')]));
  const { content } = await getJobs({});
  const summary = JSON.parse(content[0].text);
  assert.equal(summary.showing, '1–3 of 3');
  assert.equal(summary.company, 'all');
});

test('createGetJobs filters by company substring (case-insensitive)', async () => {
  const getJobs = createGetJobs(makeSource([job('Acme Corp'), job('stripe'), job('acme-labs')]));
  const { content } = await getJobs({ company: 'acme' });
  const summary = JSON.parse(content[0].text);
  assert.equal(summary.showing, '1–2 of 2');
  assert.equal(summary.company, 'acme');
  assert.ok(content[1].text.includes('Acme Corp'));
  assert.ok(content[1].text.includes('acme-labs'));
  assert.ok(!content[1].text.includes('stripe'));
});

test('createGetJobs shows "0 of 0" when no results match company filter', async () => {
  const getJobs = createGetJobs(makeSource([job('stripe'), job('notion')]));
  const { content } = await getJobs({ company: 'acme' });
  const summary = JSON.parse(content[0].text);
  assert.equal(summary.showing, '0 of 0');
  assert.equal(content[1].text, '_No matching jobs found._');
});

test('createGetJobs respects limit and offset', async () => {
  const jobs = Array.from({ length: 10 }, (_, i) => job(`company-${i}`));
  const getJobs = createGetJobs(makeSource(jobs));
  const { content } = await getJobs({ limit: 3, offset: 4 });
  const summary = JSON.parse(content[0].text);
  assert.equal(summary.showing, '5–7 of 10');
  assert.equal(summary.nextOffset, 7);
});

test('createGetJobs shows "0 of 0" when fetchJobs returns empty array', async () => {
  const getJobs = createGetJobs(makeSource([]));
  const { content } = await getJobs({});
  const summary = JSON.parse(content[0].text);
  assert.equal(summary.showing, '0 of 0');
});
