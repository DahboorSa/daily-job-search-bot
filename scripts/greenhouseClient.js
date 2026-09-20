import { greenhouseCompanies } from './greenhouseCompanies.js';
import { NOT_SPECIFIED, UNKNOWN_LOCATION, FALLBACK_URL, jobTypeFor } from './jobDefaults.js';

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
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`   Greenhouse: ${greenhouseCompanies[i]} failed — ${result.reason?.message ?? result.reason}`);
    }
  });
  return matches;
}

// "Hybrid" wins so "Hybrid (remote-friendly)" isn't listed as fully remote
const REMOTE_PATTERN = /\bremote\b|work from home|\banywhere\b/i;
const HYBRID_PATTERN = /\bhybrid\b/i;

function isRemote(job) {
  const text = `${job.location?.name ?? ''} ${job.title ?? ''}`;
  return REMOTE_PATTERN.test(text) && !HYBRID_PATTERN.test(text);
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™',
  eacute: 'é', egrave: 'è', uuml: 'ü', ouml: 'ö', auml: 'ä', ntilde: 'ñ',
  euro: '€', pound: '£', yen: '¥', cent: '¢', times: '×', divide: '÷', deg: '°', plusmn: '±',
  rarr: '→', larr: '←', laquo: '«', raquo: '»', sect: '§', para: '¶', iexcl: '¡', iquest: '¿',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', aring: 'å', ccedil: 'ç', ecirc: 'ê', euml: 'ë',
  iacute: 'í', icirc: 'î', oacute: 'ó', ocirc: 'ô', oslash: 'ø', uacute: 'ú', szlig: 'ß',
  frac12: '½', frac14: '¼', hearts: '♥', check: '✓',
};

function decodeEntities(str) {
  return str.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]*));/gi, (match, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

// Content is entity-encoded: decode, strip tags, then decode the text
export function htmlToText(content) {
  const text = decodeEntities(content ?? '')
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text).replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeGreenhouseJob({ companyName, job }) {
  return {
    title: job.title,
    company: job.company_name || companyName,
    location: job.location?.name || UNKNOWN_LOCATION,
    salary: NOT_SPECIFIED,
    description: htmlToText(job.content),
    applyUrl: job.absolute_url || FALLBACK_URL,
    postedAt: Number.isNaN(Date.parse(job.first_published)) ? '' : job.first_published,
    jobType: jobTypeFor(isRemote(job)),
  };
}
