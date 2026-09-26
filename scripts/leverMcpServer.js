import { leverCompanies } from './leverCompanies.js';
import {
  fetchLeverJobs,
  formatLeverSalary,
  LEVER_DEFAULT_DAYS_AGO,
} from './leverClient.js';
import { startJobsMcpServer } from './mcpJobsServer.js';

startJobsMcpServer({
  name: 'Lever',
  recordFile: 'lever_jobs_record.csv',
  recordUri: 'lever://jobs/record',
  csvColumns: [
    'companyName',
    'title',
    'department',
    'team',
    'employmentType',
    'location',
    'country',
    'workplaceType',
    'salaryRange',
    'publishedAt',
    'jobUrl',
    'applyUrl',
  ],
  toCsvColumns: ({ companyName, job }) => ({
    companyName,
    title: job.text,
    department: job.categories?.department,
    team: job.categories?.team,
    employmentType: job.categories?.commitment,
    location: job.categories?.location,
    country: job.country,
    workplaceType: job.workplaceType,
    salaryRange: formatLeverSalary(job.salaryRange),
    publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : '',
    jobUrl: job.hostedUrl,
    applyUrl: job.applyUrl,
  }),
  fetchJobs: fetchLeverJobs,
  defaultDaysAgo: LEVER_DEFAULT_DAYS_AGO,
  companiesCount: leverCompanies.length,
});
