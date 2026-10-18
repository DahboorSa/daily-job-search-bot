import { gemCompanies } from './gemCompanies.js';
import { isUsLocation } from './jobUtils.js';
import { NOT_SPECIFIED, UNKNOWN_LOCATION, FALLBACK_URL, jobTypeFor, buildTitleMatch } from './jobDefaults.js';

const BASE_URL = 'https://api.gem.com/job_board/v0';
export const GEM_DEFAULT_DAYS_AGO = 7;

// Departments are often empty, so filter on title only
function isEngineeringJob(job, titleMatch) {
  const title = job.title?.toLowerCase() ?? '';
  return isUsLocation(job.location?.name) && titleMatch(title);
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

export async function fetchGemJobs({ daysAgo = GEM_DEFAULT_DAYS_AGO, titleKeyword } = {}) {
  const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const titleMatch = buildTitleMatch(titleKeyword);

  const matches = [];
  const results = await Promise.allSettled(
    gemCompanies.map(async (companyName) => {
      const jobs = await fetchCompanyJobs(companyName);
      const matched = jobs
        .filter((job) => isEngineeringJob(job, titleMatch))
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

const GEM_REMOTE_PATTERN = /\bremote\b|work from home|\banywhere\b/i;
const GEM_HYBRID_PATTERN = /\bhybrid\b/i;

function isRemoteJob(job) {
  const text = `${job.location?.name ?? ''} ${job.title ?? ''}`;
  return GEM_REMOTE_PATTERN.test(text) && !GEM_HYBRID_PATTERN.test(text);
}

export function normalizeGemJob({ companyName, job }) {
  return {
    title: job.title,
    company: companyName,
    location: job.location?.name || UNKNOWN_LOCATION,
    salary: NOT_SPECIFIED,
    description: '',
    applyUrl: job.absolute_url || FALLBACK_URL,
    postedAt: job.first_published_at || '',
    jobType: jobTypeFor(isRemoteJob(job)),
  };
}
