import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocation, createGetJobs } from '../scripts/jobsMcpTool.js';

function makeFetchJobs(jobs) {
  return async () => jobs;
}

function makeSource(jobs, overrides = {}) {
  return {
    name: 'Test',
    csvColumns: ['companyName', 'title', 'location', 'country', 'isRemote', 'workplaceType', 'locationType', 'remote'],
    toCsvColumns: (m) => m,
    fetchJobs: makeFetchJobs(jobs),
    defaultDaysAgo: 7,
    companiesCount: jobs.length,
    ...overrides,
  };
}

async function getJobs(jobs, params, sourceOverrides = {}) {
  const getJobsFn = createGetJobs(makeSource(jobs, sourceOverrides));
  return getJobsFn({ limit: 100, offset: 0, title: 'engineer', ...params });
}

function titlesFrom(result) {
  return result;
}


describe('normalizeLocation', () => {
  test('maps "United States" to US', () => {
    assert.equal(normalizeLocation('United States'), 'US');
  });

  test('is case-insensitive', () => {
    assert.equal(normalizeLocation('UNITED STATES'), 'US');
    assert.equal(normalizeLocation('united states'), 'US');
  });

  test('maps common aliases', () => {
    assert.equal(normalizeLocation('USA'), 'US');
    assert.equal(normalizeLocation('UK'), 'GB');
    assert.equal(normalizeLocation('United Kingdom'), 'GB');
    assert.equal(normalizeLocation('Canada'), 'CA');
    assert.equal(normalizeLocation('Germany'), 'DE');
    assert.equal(normalizeLocation('UAE'), 'AE');
  });

  test('passes through unknown input unchanged', () => {
    assert.equal(normalizeLocation('San Francisco'), 'San Francisco');
    assert.equal(normalizeLocation('remote'), 'remote');
    assert.equal(normalizeLocation('London'), 'London');
  });
});

describe('location filter — country', () => {
  const jobs = [
    { companyName: 'A', title: 'engineer', location: 'New York, NY', country: 'US' },
    { companyName: 'B', title: 'engineer', location: 'London',       country: 'GB' },
    { companyName: 'C', title: 'engineer', location: 'Toronto',      country: 'CA' },
  ];

  test('"United States" returns only US jobs', async () => {
    const result = await getJobs(jobs, { location: 'United States' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
    assert.ok(result.content[1].text.includes('New York'));
  });

  test('"USA" also returns only US jobs', async () => {
    const result = await getJobs(jobs, { location: 'USA' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
  });

  test('"GB" returns only UK jobs', async () => {
    const result = await getJobs(jobs, { location: 'GB' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
    assert.ok(result.content[1].text.includes('London'));
  });

  test('non-matching country returns no results', async () => {
    const result = await getJobs(jobs, { location: 'Germany' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '0 of 0');
  });
});

describe('location filter — city substring', () => {
  const jobs = [
    { companyName: 'A', title: 'engineer', location: 'San Francisco, CA, USA', country: 'US' },
    { companyName: 'B', title: 'engineer', location: 'New York, NY, USA',      country: 'US' },
  ];

  test('"San Francisco" matches city substring', async () => {
    const result = await getJobs(jobs, { location: 'San Francisco' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
    assert.ok(result.content[1].text.includes('San Francisco'));
  });

  test('"New York" matches city substring', async () => {
    const result = await getJobs(jobs, { location: 'New York' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
  });
});

describe('location filter — remote', () => {
  const jobs = [
    { companyName: 'A', title: 'engineer', location: 'San Francisco', country: 'US', isRemote: false },
    { companyName: 'B', title: 'engineer', location: 'Remote',        country: 'US', isRemote: true  },   // Ashby
    { companyName: 'C', title: 'engineer', location: 'Anywhere',      country: 'US', workplaceType: 'Remote' }, // Lever
    { companyName: 'D', title: 'engineer', location: 'Remote - US',   country: 'US' },                    // Greenhouse fallback
    { companyName: 'E', title: 'engineer', location: 'Berlin',        country: 'DE', locationType: 'Remote' }, // Gem
    { companyName: 'F', title: 'engineer', location: 'Austin',        country: 'US', remote: true },       // SmartRecruiters
  ];

  test('"remote" matches isRemote: true (Ashby)', async () => {
    const result = await getJobs([jobs[0], jobs[1]], { location: 'remote' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
    assert.ok(result.content[1].text.includes('Remote'));
  });

  test('"remote" matches workplaceType: "Remote" (Lever)', async () => {
    const result = await getJobs([jobs[0], jobs[2]], { location: 'remote' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
  });

  test('"remote" matches location string containing "Remote" (Greenhouse)', async () => {
    const result = await getJobs([jobs[0], jobs[3]], { location: 'remote' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
  });

  test('"remote" matches locationType: "Remote" (Gem)', async () => {
    const result = await getJobs([jobs[0], jobs[4]], { location: 'remote' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
  });

  test('"remote" matches remote: true (SmartRecruiters)', async () => {
    const result = await getJobs([jobs[0], jobs[5]], { location: 'remote' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
  });

  test('"Remote" (capital R) also works', async () => {
    const result = await getJobs([jobs[0], jobs[1]], { location: 'Remote' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '1–1 of 1');
  });

  test('non-remote job is excluded from remote search', async () => {
    const result = await getJobs([jobs[0]], { location: 'remote' });
    const summary = JSON.parse(result.content[0].text);
    assert.equal(summary.showing, '0 of 0');
  });
});
