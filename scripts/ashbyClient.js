import { ashbyCompanies } from './ashbyCompanies.js';
import { NOT_SPECIFIED, UNKNOWN_LOCATION, FALLBACK_URL, jobTypeFor } from './jobDefaults.js';

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

// Returns US engineering jobs published within the window as { companyName, job }
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

// Same job shape as normalizeJob() in jobUtils.js
export function normalizeAshbyJob({ companyName, job }) {
  return {
    title: job.title,
    company: companyName,
    location: job.location || UNKNOWN_LOCATION,
    salary:
      job.compensation?.compensationTierSummary ||
      job.compensation?.scrapeableCompensationSalarySummary ||
      NOT_SPECIFIED,
    salaryMin: salaryMinFor(job),
    description: job.descriptionPlain ?? '',
    applyUrl: job.applyUrl || job.jobUrl || FALLBACK_URL,
    postedAt: job.publishedAt ?? '',
    jobType: jobTypeFor(job.isRemote),
  };
}
