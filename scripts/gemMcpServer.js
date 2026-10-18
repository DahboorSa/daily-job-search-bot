import { gemCompanies } from './gemCompanies.js';
import { fetchGemJobs, GEM_DEFAULT_DAYS_AGO } from './gemClient.js';
import { startJobsMcpServer } from './mcpJobsServer.js';

startJobsMcpServer({
  name: 'Gem',
  recordFile: 'gem_jobs_record.csv',
  recordUri: 'gem://jobs/record',
  csvColumns: [
    'companyName',
    'title',
    'department',
    'employmentType',
    'location',
    'locationType',
    'publishedAt',
    'jobUrl',
  ],
  toCsvColumns: ({ companyName, job }) => ({
    companyName,
    title: job.title,
    department: (job.departments ?? []).map((d) => d.name).join('; '),
    employmentType: job.employment_type,
    location: job.location?.name,
    locationType: job.location_type,
    publishedAt: job.first_published_at,
    jobUrl: job.absolute_url,
  }),
  fetchJobs: fetchGemJobs,
  defaultDaysAgo: GEM_DEFAULT_DAYS_AGO,
  companiesCount: gemCompanies.length,
});
