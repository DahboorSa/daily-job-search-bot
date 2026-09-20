import { ashbyCompanies } from './ashbyCompanies.js';

const BASE_URL = 'https://api.ashbyhq.com/posting-api/job-board';
export const ASHBY_DEFAULT_DAYS_AGO = 7;

function isEngineeringJob(job) {
  return (
    (job.location?.includes('US') ||
      job.location?.includes('USA') ||
      job.country?.toLowerCase().includes('united states') ||
      job.country?.includes('USA') ||
      job.country?.includes('US')) &&
    (job.department?.toLowerCase().includes('engineer') ||
      job.team?.toLowerCase().includes('engineer')) &&
    (job.title.toLowerCase().includes('software engineer') ||
      job.title.toLowerCase().includes('backend'))
  );
}

function isPublishedWithin(job, cutoffDate) {
  if (!job.publishedAt) return true;
  return new Date(job.publishedAt) >= cutoffDate;
}

async function fetchCompanyJobs(companyName) {
  const response = await fetch(
    `${BASE_URL}/${companyName}?includeCompensation=true`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    console.error(`   Ashby: ${companyName} responded ${response.status}`);
    return [];
  }
  const data = await response.json();
  return data.jobs || [];
}

// Fetches every configured company's board, filters to US engineering jobs
// published within the window, and returns { companyName, job } pairs.
export async function fetchAshbyJobs({
  daysAgo = ASHBY_DEFAULT_DAYS_AGO,
} = {}) {
  const cutoffDate = new Date(
    Date.now() - daysAgo * 24 * 60 * 60 * 1000,
  );

  const matches = [];
  const results = await Promise.allSettled(
    ashbyCompanies.map(async (companyName) => {
      const jobs = await fetchCompanyJobs(companyName);
      const matched = jobs
        .filter(isEngineeringJob)
        .filter((job) => isPublishedWithin(job, cutoffDate));
      for (const job of matched) matches.push({ companyName, job });
    }),
  );
  // Log failed companies instead of dropping them silently
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`   Ashby: ${ashbyCompanies[i]} failed — ${result.reason?.message ?? result.reason}`);
    }
  });
  return matches;
}

// Yearly USD salary floor, so the min_salary filter covers Ashby jobs
function salaryMinFor(job) {
  const salary = (job.compensation?.summaryComponents ?? []).find(
    (c) =>
      c.compensationType === 'Salary' &&
      c.currencyCode === 'USD' &&
      c.interval === '1 YEAR' &&
      c.minValue,
  );
  return salary?.minValue;
}

// Shapes a raw Ashby job into the same job object jobSearch.js works with
// (see normalizeJob() in jobSearch.js for the JSearch equivalent).
export function normalizeAshbyJob({ companyName, job }) {
  return {
    title: job.title,
    company: companyName,
    location: job.location || 'Unknown',
    salary:
      job.compensation?.compensationTierSummary ||
      job.compensation?.scrapeableCompensationSalarySummary ||
      'Not specified',
    salaryMin: salaryMinFor(job),
    description: job.descriptionPlain ?? '',
    applyUrl: job.applyUrl || job.jobUrl || '#',
    postedAt: job.publishedAt ?? '',
    jobType: job.isRemote ? 'Remote' : 'On-site / Hybrid',
  };
}
