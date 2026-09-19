import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ashbyCompanies } from './ashbyCompanies.js';
import { fetchAshbyJobs, ASHBY_DEFAULT_DAYS_AGO } from './ashbyClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const JOBS_RECORD_FILE = 'ashby_jobs_record.csv';
const JOBS_RECORD_URI = 'ashby://jobs/record';

const CSV_COLUMNS = [
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
];

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsvRow(row) {
  return CSV_COLUMNS.map((col) => csvEscape(row[col])).join(',');
}

function toCsvColumns({ companyName, job }) {
  return {
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
  };
}

async function getJobs({ daysAgo }) {
  const effectiveDaysAgo = daysAgo && daysAgo > 0 ? daysAgo : ASHBY_DEFAULT_DAYS_AGO;
  const runDate = new Date();

  const filePath = join(DATA_DIR, JOBS_RECORD_FILE);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(filePath, CSV_COLUMNS.join(',') + '\n', 'utf-8');

  try {
    const matches = await fetchAshbyJobs({ daysAgo: effectiveDaysAgo });
    const companiesWithMatches = new Set(matches.map((m) => m.companyName)).size;

    if (matches.length) {
      const csvLines = matches.map((m) => toCsvRow(toCsvColumns(m))).join('\n');
      writeFileSync(filePath, CSV_COLUMNS.join(',') + '\n' + csvLines + '\n', 'utf-8');
    }
    console.error('total is ', matches.length);

    const summary = {
      totalJobs: matches.length,
      companiesSearched: ashbyCompanies.length,
      companiesWithMatches,
      daysAgo: effectiveDaysAgo,
      runAt: runDate.toISOString(),
      csvFile: filePath,
    };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
        {
          type: 'resource_link',
          uri: JOBS_RECORD_URI,
          name: JOBS_RECORD_FILE,
          mimeType: 'text/csv',
        },
      ],
    };
  } catch (error) {
    console.error(`error in getJobs`, error);
    return {
      content: [
        {
          type: 'text',
          text: 'Error fetching jobs from Ashbyhq',
        },
      ],
    };
  }
}

const server = new McpServer({
  name: 'Ashbyhq',
  version: '1.0.0',
});

server.registerTool(
  'get_jobs',
  {
    title: 'Ashbyhq Alert',
    description:
      'Get engineering jobs from Ashby job boards published within the last N days, write matches to a CSV file, and return a summary.',
    inputSchema: z.object({
      daysAgo: z
        .number()
        .int()
        .positive()
        .max(365)
        .optional()
        .describe(
          `Only include jobs published within this many days (e.g. 2 or 14). Defaults to ${ASHBY_DEFAULT_DAYS_AGO}.`,
        ),
    }),
  },
  ({ daysAgo }) => getJobs({ daysAgo }),
);

server.registerResource(
  'jobs_record',
  JOBS_RECORD_URI,
  {
    title: 'Ashby Jobs Record',
    description: 'Latest CSV export of matched jobs from the most recent get_jobs run.',
    mimeType: 'text/csv',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'text/csv',
        text: readFileSync(join(DATA_DIR, JOBS_RECORD_FILE), 'utf-8'),
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ashbyhq MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
