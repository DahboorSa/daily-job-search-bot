import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateResumeForJob } from './resumeGenerator.js';
import { analyzeJob } from './searchEngine.js';
import { sendDailyReport } from './emailSender.js';
import { getGlassdoorData } from './glassdoorClient.js';
import { fetchAshbyJobs, normalizeAshbyJob } from './ashbyClient.js';
import { loadJobs, saveJobs, upsertJobs } from './jobsTracker.js';
import { generateDashboard } from './dashboardGenerator.js';
import {
  MIN_MATCH_SCORE,
  MAX_JOBS_PER_RUN,
  GENERATE_RESUMES,
  SEND_EMAIL,
  FETCH_GLASSDOOR,
  FETCH_ASHBY,
  ASHBY_DAYS_AGO,
  DATE_POSTED,
} from '../config/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname, '..');
const CONFIG_PATH = join(BASE_DIR, 'config', 'profile.json');
const SEARCHED_JOBS_PATH = join(BASE_DIR, 'data', 'searched_jobs.json');
const today = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = join(BASE_DIR, 'output', today);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';

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

function getCountryCode(location) {
  const loc = location.toLowerCase();
  for (const [code, keywords] of COUNTRY_KEYWORDS) {
    if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(loc))) return code;
  }
  return 'us';
}

async function searchJobs(keywords, location) {
  const params = new URLSearchParams({
    query: `${keywords} in ${location}`,
    page: '1',
    num_pages: '2',
    date_posted: DATE_POSTED,
    employment_types: 'FULLTIME',
    country: getCountryCode(location),
  });

  try {
    const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const jobs = (data.data ?? []).map(normalizeJob);
    console.log(`   Found ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    console.error(`   ❌ Search failed: ${err.message}`);
    return [];
  }
}

function normalizeJob(raw) {
  const min = raw.job_min_salary;
  const max = raw.job_max_salary;
  const period = raw.job_salary_period ?? 'YEAR';
  const fmt = (n) => `$${Number(n).toLocaleString()}`;

  let salary = 'Not specified';
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
  const location = [city, state].filter(Boolean).join(', ') || 'Unknown';

  return {
    title: raw.job_title ?? '',
    company: raw.employer_name ?? '',
    location,
    salary,
    salaryMin: min,
    description: raw.job_description ?? '',
    applyUrl: raw.job_apply_link ?? raw.job_google_link ?? '#',
    postedAt: raw.job_posted_at_datetime_utc ?? '',
    jobType: raw.job_is_remote ? 'Remote' : 'On-site / Hybrid',
  };
}

function loadSearchedJobs() {
  mkdirSync(join(BASE_DIR, 'data'), { recursive: true });
  if (existsSync(SEARCHED_JOBS_PATH)) {
    return new Set(JSON.parse(readFileSync(SEARCHED_JOBS_PATH, 'utf-8')));
  }
  return new Set();
}

function saveSearchedJobs(seen) {
  writeFileSync(SEARCHED_JOBS_PATH, JSON.stringify([...seen], null, 2));
}

// Compare by letters/digits so Ashby slugs ("reflectionai") match JSearch names ("Reflection AI, Inc.")
function normalizeCompany(name) {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function jobId(job) {
  const key = `${job.title}-${normalizeCompany(job.company)}-${job.location}`.toLowerCase();
  return createHash('md5').update(key).digest('hex');
}

// ID format from before company names were normalized; keeps old seen jobs seen
function legacyJobId(job) {
  const key = `${job.title}-${job.company}-${job.location}`.toLowerCase();
  return createHash('md5').update(key).digest('hex');
}

function isRelevant(job, profile) {
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

function findLinkedInUrl(companyName) {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log(`🤖 Daily Job Search Bot — ${new Date().toUTCString()}`);
  console.log(
    `📄 Resumes: ${GENERATE_RESUMES ? 'ON' : 'OFF'} | Min score: ${MIN_MATCH_SCORE} | Max jobs: ${MAX_JOBS_PER_RUN}`,
  );

  const profile = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const { search_titles, locations } = profile.job_preferences;
  const SEARCHES = search_titles.flatMap((title) =>
    locations.map((loc) => [title, loc]),
  );

  const searchedJobs = loadSearchedJobs();
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const allJobs = [];
  if (RAPIDAPI_KEY) {
    for (const [keywords, location] of SEARCHES) {
      console.log(`\n🔍 "${keywords}" in "${location}"`);
      const jobs = await searchJobs(keywords, location);
      allJobs.push(...jobs);
      await sleep(1000);
    }
  } else {
    console.error('❌ RAPIDAPI_KEY not set — skipping JSearch (check your .env or GitHub secrets).');
  }

  if (FETCH_ASHBY) {
    console.log(`\n🔍 Ashby job boards (last ${ASHBY_DAYS_AGO}d)`);
    const ashbyMatches = await fetchAshbyJobs({ daysAgo: ASHBY_DAYS_AGO });
    const ashbyJobs = ashbyMatches.map(normalizeAshbyJob);
    console.log(`   Found ${ashbyJobs.length} jobs`);
    allJobs.push(...ashbyJobs);
  }

  const uniqueMap = new Map();
  for (const job of allJobs) {
    const id = jobId(job);
    if (!uniqueMap.has(id)) uniqueMap.set(id, job);
  }
  const uniqueJobs = [...uniqueMap.values()];

  const jobs = uniqueJobs
    .filter((j) => !searchedJobs.has(jobId(j)) && !searchedJobs.has(legacyJobId(j)))
    .filter((j) => isRelevant(j, profile));
  console.log(
    `\n📊 ${allJobs.length} found → ${uniqueJobs.length} unique → ${jobs.length} new & relevant`,
  );

  if (jobs.length === 0) {
    if (SEND_EMAIL) {
      console.log('No new jobs today — sending empty report.');
      await sendDailyReport([], []);
    } else {
      console.log('No new jobs today — skipping email (SEND_EMAIL = false).');
    }
    return;
  }

  // Score everything first so low scorers don't use up MAX_JOBS_PER_RUN slots
  const qualified = [];
  for (const job of jobs) {
    const id = jobId(job);
    const analysis = analyzeJob(
      job.title,
      job.description ?? '',
      profile.search_config,
    );
    if (analysis.matchScore < MIN_MATCH_SCORE) {
      searchedJobs.add(id);
    } else {
      qualified.push({ job, id, analysis });
    }
  }
  qualified.sort((a, b) => b.analysis.matchScore - a.analysis.matchScore);
  console.log(
    `🎯 ${qualified.length} of ${jobs.length} scored ≥ ${MIN_MATCH_SCORE}`,
  );

  const results = [];
  const resumeFiles = [];

  for (const { job, id, analysis } of qualified.slice(0, MAX_JOBS_PER_RUN)) {
    console.log(`\n📝 ${job.title} @ ${job.company} (${job.location})`);

    try {
      const linkedinUrl = findLinkedInUrl(job.company);

      const glassDoorData = FETCH_GLASSDOOR
        ? await getGlassdoorData(job.title, job.location)
        : { salaryRange: null };
      let resultData = {
        id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        applyUrl: job.applyUrl,
        postedAt: job.postedAt,
        jobType: job.jobType,
        matchScore: analysis.matchScore,
        matchReason: analysis.matchReason,
        topSkills: analysis.topSkills,
        resumeFilename: 'N/A — resume generation disabled',
        linkedinUrl,
        ...glassDoorData,
      };

      if (GENERATE_RESUMES) {
        const result = await generateResumeForJob(
          profile,
          job,
          analysis,
          OUTPUT_DIR,
        );
        resultData.resumeFilename = result.filename;
        resumeFiles.push(result.filePath);
      }

      results.push(resultData);
      searchedJobs.add(id);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  const trackedJobs = loadJobs();
  const updatedJobs = upsertJobs(trackedJobs, results);
  saveJobs(updatedJobs);
  generateDashboard(updatedJobs);

  saveSearchedJobs(searchedJobs);

  if (SEND_EMAIL) {
    console.log(`\n📬 Sending report — ${results.length} match(es)...`);
    await sendDailyReport(results, resumeFiles);
  } else {
    console.log('\n📧 Email disabled — skipping report.');
  }

  console.log('\n🏁 Done!');
}

run().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
