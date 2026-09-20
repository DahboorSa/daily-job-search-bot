import { ashbyCompanies } from './ashbyCompanies.js';
import { fetchAshbyJobs, ASHBY_DEFAULT_DAYS_AGO } from './ashbyClient.js';
import { startJobsMcpServer } from './mcpJobsServer.js';

startJobsMcpServer({
  name: 'Ashbyhq',
  recordFile: 'ashby_jobs_record.csv',
  recordUri: 'ashby://jobs/record',
  csvColumns: [
    'companyName',
    'title',
    'team',
    'employmentType',
    'location',
    'country',
    'isRemote',
    'compensation',
    'publishedAt',
    'jobUrl',
  ],
  toCsvColumns: ({ companyName, job }) => ({
    companyName,
    title: job.title,
    team: job.team,
    employmentType: job.employmentType,
    location: job.location,
    country: job.address?.postalAddress?.addressCountry,
    isRemote: job.isRemote,
    compensation:
      job.compensation?.compensationTierSummary ||
      job.compensation?.scrapeableCompensationSalarySummary ||
      'No compensation',
    publishedAt: job.publishedAt,
    jobUrl: job.jobUrl,
  }),
  fetchJobs: fetchAshbyJobs,
  defaultDaysAgo: ASHBY_DEFAULT_DAYS_AGO,
  companiesCount: ashbyCompanies.length,
}).catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
