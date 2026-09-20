import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function runJobsMcpServer(source) {
  const {
    name,
    recordFile,
    recordUri,
    csvColumns,
    toCsvColumns,
    fetchJobs,
    defaultDaysAgo,
    companiesCount,
  } = source;

  const filePath = join(DATA_DIR, recordFile);
  const header = csvColumns.join(',') + '\n';
  const toCsvRow = (row) => csvColumns.map((col) => csvEscape(row[col])).join(',');

  async function getJobs({ daysAgo }) {
    const effectiveDaysAgo = daysAgo && daysAgo > 0 ? daysAgo : defaultDaysAgo;
    const runDate = new Date();

    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(filePath, header, 'utf-8');

    try {
      const matches = await fetchJobs({ daysAgo: effectiveDaysAgo });
      const companiesWithMatches = new Set(matches.map((m) => m.companyName)).size;

      if (matches.length) {
        const csvLines = matches.map((m) => toCsvRow(toCsvColumns(m))).join('\n');
        writeFileSync(filePath, header + csvLines + '\n', 'utf-8');
      }

      const summary = {
        totalJobs: matches.length,
        companiesSearched: companiesCount,
        companiesWithMatches,
        daysAgo: effectiveDaysAgo,
        runAt: runDate.toISOString(),
        csvFile: filePath,
      };
      return {
        content: [
          { type: 'text', text: JSON.stringify(summary, null, 2) },
          {
            type: 'resource_link',
            uri: recordUri,
            name: recordFile,
            mimeType: 'text/csv',
          },
        ],
      };
    } catch (error) {
      console.error('error in getJobs', error);
      return {
        content: [{ type: 'text', text: `Error fetching jobs from ${name}` }],
      };
    }
  }

  const server = new McpServer({ name, version: '1.0.0' });

  server.registerTool(
    'get_jobs',
    {
      title: `${name} Alert`,
      description: `Get engineering jobs from ${name} job boards published within the last N days, write matches to a CSV file, and return a summary.`,
      inputSchema: z.object({
        daysAgo: z
          .number()
          .int()
          .positive()
          .max(365)
          .optional()
          .describe(
            `Only include jobs published within this many days (e.g. 2 or 14). Defaults to ${defaultDaysAgo}.`,
          ),
      }),
    },
    ({ daysAgo }) => getJobs({ daysAgo }),
  );

  server.registerResource(
    'jobs_record',
    recordUri,
    {
      title: `${name} Jobs Record`,
      description: 'Latest CSV export of matched jobs from the most recent get_jobs run.',
      mimeType: 'text/csv',
    },
    async (uri) => {
      let text = header; // no export yet
      try {
        text = readFileSync(filePath, 'utf-8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      return { contents: [{ uri: uri.href, mimeType: 'text/csv', text }] };
    },
  );

  await server.connect(new StdioServerTransport());
  console.error(`${name} MCP Server running on stdio`);
}

// Stdio MCP server whose `get_jobs` tool exports matches to CSV (Ashby + Greenhouse)
export function startJobsMcpServer(source) {
  runJobsMcpServer(source).catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}
