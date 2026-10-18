import { gemCompanies } from './gemCompanies.js';
import { isUsLocation } from './jobUtils.js';

const BASE_URL = 'https://api.gem.com/job_board/v0';
export const GEM_DEFAULT_DAYS_AGO = 7;

// Departments are often empty, so filter on title only
function isEngineeringJob(job) {
  const title = job.title?.toLowerCase() ?? '';
  return (
    isUsLocation(job.location?.name) &&
    (title.includes('software engineer') || title.includes('backend'))
  );
}

function isPublishedWithin(job, cutoffDate) {
  if (!job.first_published_at) return true;
  return new Date(job.first_published_at) >= cutoffDate;
}

async function fetchCompanyJobs(companyName) {
  const response = await fetch(`${BASE_URL}/${companyName}/job_posts/`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    console.error(`   Gem: ${companyName} responded ${response.status}`);
    return [];
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Returns US engineering jobs published within the window as { companyName, job }
export async function fetchGemJobs({ daysAgo = GEM_DEFAULT_DAYS_AGO } = {}) {
  const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  const matches = [];
  const results = await Promise.allSettled(
    gemCompanies.map(async (companyName) => {
      const jobs = await fetchCompanyJobs(companyName);
      const matched = jobs
        .filter(isEngineeringJob)
        .filter((job) => isPublishedWithin(job, cutoffDate));
      for (const job of matched) matches.push({ companyName, job });
    }),
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`   Gem: ${gemCompanies[i]} failed — ${result.reason?.message ?? result.reason}`);
    }
  });
  return matches;
}
