import { smartRecruitersCompanies } from './smartRecruitersCompanies.js';

const BASE_URL = 'https://api.smartrecruiters.com/v1/companies';
const PAGE_SIZE = 100; // API maximum
const MAX_PAGES = 20;
export const SMARTRECRUITERS_DEFAULT_DAYS_AGO = 7;

// Department is often empty and function too broad, so filter on title only
function isEngineeringJob(job) {
  const title = job.name?.toLowerCase() ?? '';
  return (
    job.location?.country?.toLowerCase() === 'us' &&
    (title.includes('software engineer') || title.includes('backend'))
  );
}

function isPublishedWithin(job, cutoffDate) {
  if (!job.releasedDate) return true;
  return new Date(job.releasedDate) >= cutoffDate;
}

async function fetchCompanyJobs(companyName) {
  const jobs = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const response = await fetch(
      `${BASE_URL}/${companyName}/postings?country=us&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      console.error(`   SmartRecruiters: ${companyName} responded ${response.status}`);
      break;
    }
    const data = await response.json();
    const content = Array.isArray(data.content) ? data.content : [];
    jobs.push(...content);
    if (content.length < PAGE_SIZE || offset + content.length >= (data.totalFound ?? 0)) break;
  }
  return jobs;
}

// Returns US engineering jobs published within the window as { companyName, job }
export async function fetchSmartRecruitersJobs({ daysAgo = SMARTRECRUITERS_DEFAULT_DAYS_AGO } = {}) {
  const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  const matches = [];
  const results = await Promise.allSettled(
    smartRecruitersCompanies.map(async (companyName) => {
      const jobs = await fetchCompanyJobs(companyName);
      const matched = jobs
        .filter(isEngineeringJob)
        .filter((job) => isPublishedWithin(job, cutoffDate));
      for (const job of matched) matches.push({ companyName, job });
    }),
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(
        `   SmartRecruiters: ${smartRecruitersCompanies[i]} failed — ${result.reason?.message ?? result.reason}`,
      );
    }
  });
  return matches;
}

export function smartRecruitersJobUrl({ companyName, job }) {
  return `https://jobs.smartrecruiters.com/${job.company?.identifier ?? companyName}/${job.id}`;
}
