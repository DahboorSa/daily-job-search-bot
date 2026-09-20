import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCountryCode,
  normalizeJob,
  normalizeCompany,
  jobId,
  legacyJobId,
  isRelevant,
  selectNewJobs,
  scoreJobs,
} from '../scripts/jobUtils.js';

test('getCountryCode matches whole words only', () => {
  assert.equal(getCountryCode('Amman, Jordan'), 'jo');
  assert.equal(getCountryCode('London'), 'gb');
  assert.equal(getCountryCode('Milwaukee, WI'), 'us');
  assert.equal(getCountryCode('Indianapolis, IN'), 'us');
  assert.equal(getCountryCode('Austin, TX'), 'us');
});

test('normalizeCompany makes Ashby slugs and JSearch names comparable', () => {
  assert.equal(normalizeCompany('Reflection AI, Inc.'), normalizeCompany('reflectionai'));
  assert.equal(normalizeCompany('Acme Corp'), 'acme');
});

test('jobId is stable, case-insensitive and normalizes company names', () => {
  const a = { title: 'Backend Engineer', company: 'Reflection AI, Inc.', location: 'Austin, TX' };
  const b = { title: 'backend engineer', company: 'reflectionai', location: 'austin, tx' };
  assert.equal(jobId(a), jobId(b));
  assert.notEqual(jobId(a), jobId({ ...a, location: 'Remote' }));
  assert.match(jobId(a), /^[0-9a-f]{32}$/);
});

test('legacyJobId keeps the old un-normalized format', () => {
  const a = { title: 'T', company: 'Acme, Inc.', location: 'L' };
  assert.notEqual(legacyJobId(a), jobId(a));
  assert.equal(legacyJobId(a), legacyJobId({ ...a, title: 't' }));
});

test('normalizeJob formats salary by period and builds location', () => {
  const base = { job_title: 'T', employer_name: 'E', job_city: 'Austin', job_state: 'TX' };
  const yearly = normalizeJob({ ...base, job_min_salary: 100000, job_max_salary: 150000 });
  assert.equal(yearly.salary, '$100,000 – $150,000/yr');
  assert.equal(yearly.salaryMin, 100000);
  assert.equal(yearly.location, 'Austin, TX');

  const monthly = normalizeJob({ ...base, job_min_salary: 5000, job_max_salary: 8000, job_salary_period: 'MONTH' });
  assert.equal(monthly.salary, '$5,000 – $8,000/mo');

  const hourly = normalizeJob({ ...base, job_min_salary: 50, job_max_salary: 80, job_salary_period: 'HOUR' });
  assert.equal(hourly.salary, '$50 – $80');
});

test('normalizeJob falls back for missing fields', () => {
  const j = normalizeJob({ job_is_remote: true });
  assert.equal(j.title, '');
  assert.equal(j.location, 'Unknown');
  assert.equal(j.salary, 'Not specified');
  assert.equal(j.applyUrl, '#');
  assert.equal(j.jobType, 'Remote');
  assert.equal(normalizeJob({}).jobType, 'On-site / Hybrid');
});

test('isRelevant applies include, exclude and salary filters', () => {
  const profile = {
    job_preferences: { title_include: ['engineer'], title_exclude: ['manager'], min_salary: 100000 },
  };
  assert.equal(isRelevant({ title: 'Backend Engineer' }, profile), true);
  assert.equal(isRelevant({ title: 'Designer' }, profile), false);
  assert.equal(isRelevant({ title: 'Engineering Manager Engineer' }, profile), false);
  assert.equal(isRelevant({ title: 'Engineer', salaryMin: 80000 }, profile), false);
  assert.equal(isRelevant({ title: 'Engineer', salaryMin: 120000 }, profile), true);
  assert.equal(isRelevant({ title: 'Engineer' }, profile), true); // unknown salary passes
});

const profile = {
  job_preferences: { title_include: ['engineer'], title_exclude: [], min_salary: 0 },
};

test('selectNewJobs dedups across sources and skips seen jobs (new and legacy ids)', () => {
  const a = { title: 'Backend Engineer', company: 'Acme, Inc.', location: 'Austin, TX' };
  const aDup = { ...a, company: 'acme' }; // same job from another source
  const seenNew = { title: 'Seen Engineer', company: 'B', location: 'X' };
  const seenLegacy = { title: 'Legacy Engineer', company: 'C, Inc.', location: 'Y' };
  const irrelevant = { title: 'Designer', company: 'D', location: 'Z' };

  const searched = new Set([jobId(seenNew), legacyJobId(seenLegacy)]);
  const { uniqueCount, jobs } = selectNewJobs([a, aDup, seenNew, seenLegacy, irrelevant], searched, profile);

  assert.equal(uniqueCount, 4);
  assert.deepEqual(jobs, [a]);
});

test('scoreJobs splits by min score and sorts best first', () => {
  const config = {
    themes: { t: { keywords: ['node', 'kafka'], score: 40, skills: ['s'] }, default: { keywords: [], score: 0, skills: [] } },
    match_reasons: { default: 'r', t: 'r' },
  };
  const low = { title: 'Engineer', company: 'A', location: 'X', description: '' };
  const mid = { title: 'Engineer', company: 'B', location: 'X', description: 'node' };
  const high = { title: 'Engineer', company: 'C', location: 'X', description: 'node kafka' };

  const { qualified, lowScoreIds } = scoreJobs([low, mid, high], config, 50);
  assert.deepEqual(qualified.map((q) => q.job.company), ['C', 'B']);
  assert.deepEqual(lowScoreIds, [jobId(low)]);
});
