import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JOBS_PATH = join(__dirname, '..', 'data', 'jobs.json');

export function loadJobs() {
  mkdirSync(join(__dirname, '..', 'data'), { recursive: true });
  if (existsSync(JOBS_PATH)) {
    return JSON.parse(readFileSync(JOBS_PATH, 'utf-8'));
  }
  return [];
}

export function saveJobs(jobs) {
  writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2));
}

export function upsertJobs(existingJobs, newJobs) {
  const map = new Map(existingJobs.map((j) => [j.id, j]));
  for (const job of newJobs) {
    if (!map.has(job.id)) {
      map.set(job.id, { ...job, status: 'new', addedAt: new Date().toISOString() });
    }
  }
  return [...map.values()];
}
