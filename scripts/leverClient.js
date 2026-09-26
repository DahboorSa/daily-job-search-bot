import { leverCompanies } from './leverCompanies.js';

const BASE_URL = 'https://api.lever.co/v0/postings';
export const LEVER_DEFAULT_DAYS_AGO = 7;

// Lever's department/team names are free text ("Hinge", "Dev"), so filter on title only
function isEngineeringJob(job) {
  const title = job.text?.toLowerCase() ?? '';
  return (
    job.country?.toUpperCase() === 'US' &&
    (title.includes('software engineer') || title.includes('backend'))
  );
}

// createdAt is epoch milliseconds
function isPublishedWithin(job, cutoffDate) {
  if (!job.createdAt) return true;
  return new Date(job.createdAt) >= cutoffDate;
}

async function fetchCompanyJobs(companyName) {
  const response = await fetch(`${BASE_URL}/${companyName}?mode=json`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    console.error(`   Lever: ${companyName} responded ${response.status}`);
    return [];
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Returns US engineering jobs published within the window as { companyName, job }
export async function fetchLeverJobs({ daysAgo = LEVER_DEFAULT_DAYS_AGO } = {}) {
  const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  const matches = [];
  const results = await Promise.allSettled(
    leverCompanies.map(async (companyName) => {
      const jobs = await fetchCompanyJobs(companyName);
      const matched = jobs
        .filter(isEngineeringJob)
        .filter((job) => isPublishedWithin(job, cutoffDate));
      for (const job of matched) matches.push({ companyName, job });
    }),
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`   Lever: ${leverCompanies[i]} failed — ${result.reason?.message ?? result.reason}`);
    }
  });
  return matches;
}

const SALARY_INTERVALS = {
  'per-year-salary': '/yr',
  'per-month-salary': '/mo',
  'per-hour-wage': '/hr',
};

export function formatLeverSalary(range) {
  if (!range?.min || !range?.max) return 'No compensation';
  const fmt = (n) => Number(n).toLocaleString('en-US');
  return `${range.currency ?? ''} ${fmt(range.min)} – ${fmt(range.max)}${SALARY_INTERVALS[range.interval] ?? ''}`.trim();
}
