import { greenhouseCompanies } from './greenhouseCompanies.js';

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';
export const GREENHOUSE_DEFAULT_DAYS_AGO = 7;

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]);

// Locations are free text ("Seattle, WA"), so match a US state code or a US marker
function isUsLocation(locationName) {
  if (!locationName) return false;
  if (/united states/i.test(locationName) || /\b(US|USA)\b/.test(locationName)) {
    return true;
  }
  if (/\bD\.C\./.test(locationName)) return true;

  const codes = locationName.match(/\b[A-Z]{2}\b/g) ?? [];
  return codes.some((code) => US_STATE_CODES.has(code));
}

// Department names vary ("ENG Brick & Mortar"), so also check Division/Department metadata
function departmentNames(job) {
  const fromDepartments = (job.departments ?? []).map((d) => d.name);
  const fromMetadata = (job.metadata ?? [])
    .filter((m) => /^(division|department|team)$/i.test(m.name))
    .map((m) => m.value);
  return [...fromDepartments, ...fromMetadata].filter(
    (v) => typeof v === 'string',
  );
}

function isEngineeringJob(job) {
  const departments = departmentNames(job);
  // Boards often omit departments, so only filter when one is listed
  const inEngineering =
    departments.length === 0 ||
    departments.some((name) => /\b(eng|engineer|engineers|engineering)\b/i.test(name));
  const title = job.title?.toLowerCase() ?? '';

  return (
    isUsLocation(job.location?.name) &&
    inEngineering &&
    (title.includes('software engineer') || title.includes('backend'))
  );
}

function isPublishedWithin(job, cutoffDate) {
  if (!job.first_published) return true;
  return new Date(job.first_published) >= cutoffDate;
}

async function fetchCompanyJobs(companyName) {
  const response = await fetch(`${BASE_URL}/${companyName}/jobs?content=true`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    console.error(`   Greenhouse: ${companyName} responded ${response.status}`);
    return [];
  }
  const data = await response.json();
  return data.jobs || [];
}

// Returns US engineering jobs published within the window as { companyName, job }
export async function fetchGreenhouseJobs({
  daysAgo = GREENHOUSE_DEFAULT_DAYS_AGO,
} = {}) {
  const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  const matches = [];
  const results = await Promise.allSettled(
    greenhouseCompanies.map(async (companyName) => {
      const jobs = await fetchCompanyJobs(companyName);
      const matched = jobs
        .filter(isEngineeringJob)
        .filter((job) => isPublishedWithin(job, cutoffDate));
      for (const job of matched) matches.push({ companyName, job });
    }),
  );
  // Log failed boards instead of dropping them silently
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`   Greenhouse: ${greenhouseCompanies[i]} failed — ${result.reason?.message ?? result.reason}`);
    }
  });
  return matches;
}
