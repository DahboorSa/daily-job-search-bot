import { greenhouseCompanies } from './greenhouseCompanies.js';
import {
  fetchGreenhouseJobs,
  GREENHOUSE_DEFAULT_DAYS_AGO,
} from './greenhouseClient.js';
import { startJobsMcpServer } from './mcpJobsServer.js';

startJobsMcpServer({
  name: 'Greenhouse',
  recordFile: 'greenhouse_jobs_record.csv',
  recordUri: 'greenhouse://jobs/record',
  csvColumns: [
    'companyName',
    'title',
    'department',
    'office',
    'location',
    'publishedAt',
    'jobUrl',
  ],
  toCsvColumns: ({ companyName, job }) => ({
    companyName,
    title: job.title,
    department: (job.departments ?? []).map((d) => d.name).join(' | '),
    office: (job.offices ?? []).map((o) => o.name).join(' | '),
    location: job.location?.name,
    publishedAt: job.first_published,
    jobUrl: job.absolute_url,
  }),
  fetchJobs: fetchGreenhouseJobs,
  defaultDaysAgo: GREENHOUSE_DEFAULT_DAYS_AGO,
  companiesCount: greenhouseCompanies.length,
}).catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
