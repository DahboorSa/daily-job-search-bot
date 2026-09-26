import { smartRecruitersCompanies } from './smartRecruitersCompanies.js';
import {
  fetchSmartRecruitersJobs,
  smartRecruitersJobUrl,
  SMARTRECRUITERS_DEFAULT_DAYS_AGO,
} from './smartRecruitersClient.js';
import { startJobsMcpServer } from './mcpJobsServer.js';

startJobsMcpServer({
  name: 'SmartRecruiters',
  recordFile: 'smartrecruiters_jobs_record.csv',
  recordUri: 'smartrecruiters://jobs/record',
  csvColumns: [
    'companyName',
    'title',
    'function',
    'employmentType',
    'experienceLevel',
    'location',
    'country',
    'remote',
    'hybrid',
    'publishedAt',
    'jobUrl',
  ],
  toCsvColumns: ({ companyName, job }) => ({
    companyName: job.company?.name ?? companyName,
    title: job.name,
    function: job.function?.label,
    employmentType: job.typeOfEmployment?.label,
    experienceLevel: job.experienceLevel?.label,
    location: job.location?.fullLocation,
    country: job.location?.country?.toUpperCase(),
    remote: job.location?.remote,
    hybrid: job.location?.hybrid,
    publishedAt: job.releasedDate,
    jobUrl: smartRecruitersJobUrl({ companyName, job }),
  }),
  fetchJobs: fetchSmartRecruitersJobs,
  defaultDaysAgo: SMARTRECRUITERS_DEFAULT_DAYS_AGO,
  companiesCount: smartRecruitersCompanies.length,
});
