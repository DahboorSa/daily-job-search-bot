import { createHash } from 'crypto';
import { analyzeJob } from './searchEngine.js';
import { NOT_SPECIFIED, UNKNOWN_LOCATION, FALLBACK_URL, jobTypeFor } from './jobDefaults.js';

// Whole words only: "uk" matched Milwaukee, "india" matched Indianapolis
const COUNTRY_KEYWORDS = [
  ['jo', ['jordan', 'amman']],
  ['sa', ['saudi', 'riyadh', 'jeddah']],
  ['gb', ['uk', 'united kingdom', 'london']],
  ['ca', ['canada', 'toronto']],
  ['au', ['australia', 'sydney']],
  ['de', ['germany', 'berlin']],
  ['fr', ['france', 'paris']],
  ['in', ['india', 'bangalore', 'mumbai']],
];

export function getCountryCode(location) {
  const loc = location.toLowerCase();
  for (const [code, keywords] of COUNTRY_KEYWORDS) {
    if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(loc))) return code;
  }
  return 'us';
}

export function normalizeJob(raw) {
  const min = raw.job_min_salary;
  const max = raw.job_max_salary;
  const period = raw.job_salary_period ?? 'YEAR';
  const fmt = (n) => `$${Number(n).toLocaleString()}`;

  let salary = NOT_SPECIFIED;
  if (min && max) {
    salary =
      period === 'YEAR'
        ? `${fmt(min)} – ${fmt(max)}/yr`
        : period === 'MONTH'
          ? `${fmt(min)} – ${fmt(max)}/mo`
          : `${fmt(min)} – ${fmt(max)}`;
  }

  const city = raw.job_city ?? '';
  const state = raw.job_state ?? '';
  const location = [city, state].filter(Boolean).join(', ') || UNKNOWN_LOCATION;

  return {
    title: raw.job_title ?? '',
    company: raw.employer_name ?? '',
    location,
    salary,
    salaryMin: min,
    description: raw.job_description ?? '',
    applyUrl: raw.job_apply_link ?? raw.job_google_link ?? FALLBACK_URL,
    postedAt: raw.job_posted_at_datetime_utc ?? '',
    jobType: jobTypeFor(raw.job_is_remote),
  };
}

// Compare by letters/digits so Ashby slugs ("reflectionai") match JSearch names ("Reflection AI, Inc.")
export function normalizeCompany(name) {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function jobId(job) {
  const key = `${job.title}-${normalizeCompany(job.company)}-${job.location}`.toLowerCase();
  return createHash('md5').update(key).digest('hex');
}

// ID format from before company names were normalized; keeps old seen jobs seen
export function legacyJobId(job) {
  const key = `${job.title}-${job.company}-${job.location}`.toLowerCase();
  return createHash('md5').update(key).digest('hex');
}

export function isRelevant(job, profile) {
  const title = job.title.toLowerCase();

  if (
    profile.job_preferences.title_include &&
    !profile.job_preferences.title_include.some((kw) => title.includes(kw))
  )
    return false;

  if (job.salaryMin && job.salaryMin < profile.job_preferences.min_salary)
    return false;

  if (profile.job_preferences.title_exclude.some((kw) => title.includes(kw)))
    return false;

  return true;
}

// Dedups, then drops jobs already seen or filtered out by the profile
export function selectNewJobs(allJobs, searchedJobs, profile) {
  const uniqueMap = new Map();
  for (const job of allJobs) {
    const id = jobId(job);
    if (!uniqueMap.has(id)) uniqueMap.set(id, job);
  }
  const uniqueJobs = [...uniqueMap.values()];
  const jobs = uniqueJobs
    .filter((j) => !searchedJobs.has(jobId(j)) && !searchedJobs.has(legacyJobId(j)))
    .filter((j) => isRelevant(j, profile));
  return { uniqueCount: uniqueJobs.length, jobs };
}

// Below-threshold ids are returned so they aren't rescored tomorrow
export function scoreJobs(jobs, searchConfig, minScore) {
  const qualified = [];
  const lowScoreIds = [];
  for (const job of jobs) {
    const id = jobId(job);
    const analysis = analyzeJob(job.title, job.description ?? '', searchConfig);
    if (analysis.matchScore < minScore) lowScoreIds.push(id);
    else qualified.push({ job, id, analysis });
  }
  qualified.sort((a, b) => b.analysis.matchScore - a.analysis.matchScore);
  return { qualified, lowScoreIds };
}
