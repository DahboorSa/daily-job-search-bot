import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createGetJobs } from './jobsMcpTool.js';

export { createGetJobs } from './jobsMcpTool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// Set MCP_WRITE_CSV=true to also write a local CSV file (useful for local runs, disabled by default for server deploys)
const WRITE_CSV = process.env.MCP_WRITE_CSV === 'true';

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// afterFetch({ rows, filePath, toCsvRow, csvHeader, recordUri, recordFile }) is called after pagination
// and its return value is merged into { summaryExtras, contentExtras } to add CSV-specific fields.

async function runJobsMcpServer(source) {
  const { name, recordFile, recordUri, csvColumns, defaultDaysAgo } = source;

  const filePath = join(DATA_DIR, recordFile);
  const csvHeader = csvColumns.join(',') + '\n';
  const toCsvRow = (row) => csvColumns.map((col) => csvEscape(row[col])).join(',');

  const csvAfterFetch = WRITE_CSV
    ? ({ rows }) => {
        mkdirSync(DATA_DIR, { recursive: true });
        const csvLines = rows.map(toCsvRow).join('\n');
        writeFileSync(filePath, csvHeader + (rows.length ? csvLines + '\n' : ''), 'utf-8');
        return {
          summaryExtras: { csvFile: filePath },
          contentExtras: [{ type: 'resource_link', uri: recordUri, name: recordFile, mimeType: 'text/csv' }],
        };
      }
    : undefined;

  const getJobs = createGetJobs(source, { afterFetch: csvAfterFetch });

  const server = new McpServer({ name, version: '1.0.0' });

  server.registerTool(
    'get_jobs',
    {
      title: `${name} Alert`,
      description: `Get jobs from ${name} job boards. Always display the full markdown table exactly as returned — do not summarize or paraphrase it.${WRITE_CSV ? ' Also writes matches to a CSV file.' : ''}`,
      inputSchema: z.object({
        title: z
          .string()
          .describe('Job title to search for (case-insensitive substring, e.g. "senior software engineer", "backend", "data engineer").'),
        company: z
          .string()
          .optional()
          .describe('Filter by company name (case-insensitive substring). Omit to search all companies.'),
        daysAgo: z
          .number()
          .int()
          .positive()
          .max(365)
          .optional()
          .describe(`Only include jobs published within this many days. Defaults to ${defaultDaysAgo}.`),
        limit: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe('Max results to return (default 20). Use with offset for pagination.'),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Number of results to skip (default 0). Check nextOffset in the summary to paginate.'),
      }),
    },
    (params) => getJobs(params),
  );

  if (WRITE_CSV) {
    server.registerResource(
      'jobs_record',
      recordUri,
      {
        title: `${name} Jobs Record`,
        description: 'Latest CSV export of matched jobs from the most recent get_jobs run.',
        mimeType: 'text/csv',
      },
      async (uri) => {
        let text = csvHeader;
        try {
          text = readFileSync(filePath, 'utf-8');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        return { contents: [{ uri: uri.href, mimeType: 'text/csv', text }] };
      },
    );
  }

  await server.connect(new StdioServerTransport());
  console.error(`${name} MCP Server running on stdio${WRITE_CSV ? ' (CSV export enabled)' : ''}`);
}

export function startJobsMcpServer(source) {
  runJobsMcpServer(source).catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}
