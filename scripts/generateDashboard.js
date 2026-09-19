import { loadJobs } from './jobsTracker.js';
import { generateDashboard } from './dashboardGenerator.js';

const jobs = loadJobs();
generateDashboard(jobs);
console.log(`✅ Dashboard regenerated with ${jobs.length} jobs.`);
