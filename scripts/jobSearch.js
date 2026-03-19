import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateResumeForJob } from './resumeGenerator.js';
import { analyzeJob } from './searchEngine.js';
import { sendDailyReport } from './emailSender.js';
import {
  MIN_MATCH_SCORE,
  MAX_JOBS_PER_RUN,
  GENERATE_RESUMES,
  DATE_POSTED,
} from '../config/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname, '..');
const CONFIG_PATH = join(BASE_DIR, 'config', 'profile.json');
const SEARCHED_JOBS_PATH = join(BASE_DIR, 'data', 'searched_jobs.json');
const today = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = join(BASE_DIR, 'output', today);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';

function getCountryCode(location) {
  const loc = location.toLowerCase();
  if (loc.includes('jordan') || loc.includes('amman')) return 'jo';
  if (loc.includes('saudi') || loc.includes('riyadh') || loc.includes('jeddah'))
    return 'sa';
  if (loc.includes('uk') || loc.includes('london')) return 'gb';
  if (loc.includes('canada') || loc.includes('toronto')) return 'ca';
  if (loc.includes('australia') || loc.includes('sydney')) return 'au';
  if (loc.includes('germany') || loc.includes('berlin')) return 'de';
  if (loc.includes('france') || loc.includes('paris')) return 'fr';
  if (
    loc.includes('india') ||
    loc.includes('bangalore') ||
    loc.includes('mumbai')
  )
    return 'in';
  return 'us';
}

async function searchJobs(keywords, location) {
  if (!RAPIDAPI_KEY) {
    console.error(
      '❌ RAPIDAPI_KEY not set — check your .env or GitHub secrets.',
    );
    return [];
  }

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

// ─── Searched jobs tracker ───

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

function jobId(job) {
  const key = `${job.title}-${job.company}-${job.location}`.toLowerCase();
  return createHash('md5').update(key).digest('hex');
}

function isRelevant(job, profile) {
  const title = job.title.toLowerCase();

  if (!profile.job_preferences.title_include.some((kw) => title.includes(kw)))
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
  const line = '='.repeat(60);
  console.log(line);
  console.log(`🤖 Daily Job Hunt Bot — ${new Date().toUTCString()}`);
  console.log(
    `📄 Resumes: ${GENERATE_RESUMES ? 'ON' : 'OFF'} | Min score: ${MIN_MATCH_SCORE} | Max jobs: ${MAX_JOBS_PER_RUN}`,
  );
  console.log(line);

  const profile = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const { search_titles, locations } = profile.job_preferences;
  const SEARCHES = search_titles.flatMap((title) =>
    locations.map((loc) => [title, loc]),
  );

  const searchedJobs = loadSearchedJobs();
  console.log(`📂 Previously seen jobs: ${searchedJobs.size}`);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Search Job ──
  const allJobs = [];
  for (const [keywords, location] of SEARCHES) {
    console.log(`\n🔍 "${keywords}" in "${location}"`);
    const jobs = await searchJobs(keywords, location);
    allJobs.push(...jobs);
    await sleep(1000);
  }
  console.log(`\n📊 Total raw: ${allJobs.length}`);

  // ── Deduplicate ──
  const uniqueMap = new Map();
  for (const job of allJobs) {
    const id = jobId(job);
    if (!uniqueMap.has(id)) uniqueMap.set(id, job);
  }
  const uniqueJobs = [...uniqueMap.values()];
  console.log(`🔁 After dedup: ${uniqueJobs.length}`);

  // ── Filter seen + irrelevant ──
  const jobs = uniqueJobs
    .filter((j) => !searchedJobs.has(jobId(j)))
    .filter((j) => isRelevant(j, profile));
  console.log(`✅ New relevant jobs: ${jobs.length}`);

  if (jobs.length === 0) {
    console.log('No new jobs today — sending empty report.');
    await sendDailyReport([], []);
    saveSearchedJobs(searchedJobs);
    return;
  }

  // ── Process each job ──
  const results = [];
  const resumeFiles = [];

  for (const job of jobs.slice(0, MAX_JOBS_PER_RUN)) {
    const id = jobId(job);
    console.log(`\n📝 ${job.title} @ ${job.company} (${job.location})`);

    try {
      const linkedinUrl = findLinkedInUrl(job.company);

      const analysis = analyzeJob(
        job.title,
        job.description ?? '',
        profile.search_config,
      );

      if (analysis.matchScore < MIN_MATCH_SCORE) {
        console.log(`   ⚠️  Score ${analysis.matchScore} — skipping.`);
        searchedJobs.add(id);
        continue;
      }

      let resultData = {
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
      };

      if (GENERATE_RESUMES) {
        const result = await generateResumeForJob(profile, job, analysis, OUTPUT_DIR);
        resultData.resumeFilename = result.filename;
        resumeFiles.push(result.filePath);
      }

      results.push(resultData);
      searchedJobs.add(id);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  // ── Sort best matches first ──
  results.sort((a, b) => b.matchScore - a.matchScore);
  console.log(`\n📬 Sending report — ${results.length} match(es)...`);

  saveSearchedJobs(searchedJobs);
  await sendDailyReport(results, resumeFiles);

  console.log(line);
  console.log('🏁 Done! Check your inbox.');
  console.log(line);
}

run().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
