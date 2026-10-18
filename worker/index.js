import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { createGetJobs, buildToolSchema } from '../scripts/jobsMcpTool.js';
import { DAYS_AGO } from '../config/settings.js';

import { ashbyCompanies } from '../scripts/ashbyCompanies.js';
import { fetchAshbyJobs } from '../scripts/ashbyClient.js';

import { leverCompanies } from '../scripts/leverCompanies.js';
import { fetchLeverJobs, formatLeverSalary } from '../scripts/leverClient.js';

import { greenhouseCompanies } from '../scripts/greenhouseCompanies.js';
import { fetchGreenhouseJobs } from '../scripts/greenhouseClient.js';

import { smartRecruitersCompanies } from '../scripts/smartRecruitersCompanies.js';
import { fetchSmartRecruitersJobs, smartRecruitersJobUrl } from '../scripts/smartRecruitersClient.js';

import { gemCompanies } from '../scripts/gemCompanies.js';
import { fetchGemJobs } from '../scripts/gemClient.js';

const sources = [
  {
    toolName: 'get_ashby_jobs',
    toolTitle: 'Ashby Jobs',
    source: {
      name: 'Ashby',
      csvColumns: ['companyName', 'title', 'team', 'employmentType', 'location', 'country', 'isRemote', 'compensation', 'publishedAt', 'jobUrl'],
      toCsvColumns: ({ companyName, job }) => ({
        companyName,
        title: job.title,
        team: job.team,
        employmentType: job.employmentType,
        location: job.location,
        country: job.address?.postalAddress?.addressCountry,
        isRemote: job.isRemote,
        compensation: job.compensation?.compensationTierSummary || job.compensation?.scrapeableCompensationSalarySummary || 'No compensation',
        publishedAt: job.publishedAt,
        jobUrl: job.jobUrl,
      }),
      fetchJobs: fetchAshbyJobs,
      defaultDaysAgo: DAYS_AGO,
      companiesCount: ashbyCompanies.length,
    },
  },
  {
    toolName: 'get_lever_jobs',
    toolTitle: 'Lever Jobs',
    source: {
      name: 'Lever',
      csvColumns: ['companyName', 'title', 'department', 'team', 'employmentType', 'location', 'country', 'workplaceType', 'salaryRange', 'publishedAt', 'jobUrl', 'applyUrl'],
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
      defaultDaysAgo: DAYS_AGO,
      companiesCount: leverCompanies.length,
    },
  },
  {
    toolName: 'get_greenhouse_jobs',
    toolTitle: 'Greenhouse Jobs',
    source: {
      name: 'Greenhouse',
      csvColumns: ['companyName', 'title', 'department', 'office', 'location', 'publishedAt', 'jobUrl'],
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
      defaultDaysAgo: DAYS_AGO,
      companiesCount: greenhouseCompanies.length,
    },
  },
  {
    toolName: 'get_smartrecruiters_jobs',
    toolTitle: 'SmartRecruiters Jobs',
    source: {
      name: 'SmartRecruiters',
      csvColumns: ['companyName', 'title', 'function', 'employmentType', 'experienceLevel', 'location', 'country', 'remote', 'hybrid', 'publishedAt', 'jobUrl'],
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
      defaultDaysAgo: DAYS_AGO,
      companiesCount: smartRecruitersCompanies.length,
    },
  },
  {
    toolName: 'get_gem_jobs',
    toolTitle: 'Gem Jobs',
    source: {
      name: 'Gem',
      csvColumns: ['companyName', 'title', 'department', 'employmentType', 'location', 'locationType', 'publishedAt', 'jobUrl'],
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
      defaultDaysAgo: DAYS_AGO,
      companiesCount: gemCompanies.length,
    },
  },
];

const mcpServer = createMcpHandler((serverInfo) => {
  const server = new McpServer({ name: 'job-boards-mcp', version: '1.0.0' });

  for (const { toolName, toolTitle, source } of sources) {
    const getJobs = createGetJobs(source);
    server.registerTool(
      toolName,
      {
        title: toolTitle,
        description: `Get jobs from ${source.name} job boards. Always display the full markdown table exactly as returned — do not summarize or paraphrase it.`,
        inputSchema: buildToolSchema(source.defaultDaysAgo),
      },
      (params) => getJobs(params),
    );
  }

  return server;
});

export default {
  async fetch(request, env, ctx) {
    return mcpServer.fetch(request, env, ctx);
  },
};
