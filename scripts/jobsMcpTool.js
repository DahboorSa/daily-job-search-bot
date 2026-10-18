import { z } from 'zod';

const COUNTRY_ALIASES = {
  'united states': 'US',
  usa: 'US',
  america: 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  canada: 'CA',
  germany: 'DE',
  france: 'FR',
  australia: 'AU',
  netherlands: 'NL',
  india: 'IN',
  singapore: 'SG',
  ireland: 'IE',
  spain: 'ES',
  sweden: 'SE',
  brazil: 'BR',
  mexico: 'MX',
  japan: 'JP',
  'south korea': 'KR',
  korea: 'KR',
  poland: 'PL',
  denmark: 'DK',
  norway: 'NO',
  finland: 'FI',
  switzerland: 'CH',
  austria: 'AT',
  belgium: 'BE',
  portugal: 'PT',
  italy: 'IT',
  'new zealand': 'NZ',
  'south africa': 'ZA',
  uae: 'AE',
  'united arab emirates': 'AE',
};

export function normalizeLocation(input) {
  return COUNTRY_ALIASES[input.toLowerCase().trim()] ?? input;
}

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildMarkdownTable(columns, rows) {
  const header = `| ${columns.join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .map(
      (row) => `| ${columns.map((col) => csvEscape(row[col])).join(' | ')} |`,
    )
    .join('\n');
  return [header, divider, body].join('\n');
}

export function createGetJobs(source, { afterFetch } = {}) {
  const {
    name,
    csvColumns,
    toCsvColumns,
    fetchJobs,
    defaultDaysAgo,
    companiesCount,
  } = source;

  return async function getJobs({
    daysAgo,
    title,
    location,
    company,
    limit = 20,
    offset = 0,
  }) {
    const effectiveDaysAgo = daysAgo && daysAgo > 0 ? daysAgo : defaultDaysAgo;
    const runDate = new Date();

    try {
      const matches = await fetchJobs({
        daysAgo: effectiveDaysAgo,
        titleKeyword: title,
      });

      const isRemoteSearch = location.toLowerCase().trim() === 'remote';
      const normalized = normalizeLocation(location);
      const normalizedLower = normalized.toLowerCase();

      const locationFiltered = matches.filter((m) => {
        const cols = toCsvColumns(m);
        if (isRemoteSearch) {
          return (
            cols.isRemote === true ||
            cols.remote === true ||
            String(cols.workplaceType ?? '').toLowerCase().includes('remote') ||
            String(cols.locationType ?? '').toLowerCase().includes('remote') ||
            String(cols.location ?? '').toLowerCase().includes('remote')
          );
        }
        if (cols.country && cols.country.toLowerCase() === normalizedLower) return true;
        return String(cols.location ?? '').toLowerCase().includes(normalizedLower);
      });

      const filtered = company
        ? locationFiltered.filter((m) => {
            const companyName = (
              toCsvColumns(m).companyName ??
              m.companyName ??
              ''
            ).toLowerCase();
            return companyName.includes(company.toLowerCase());
          })
        : locationFiltered;

      const page = filtered.slice(offset, offset + limit);
      const rows = page.map(toCsvColumns);
      const companiesWithMatches = new Set(filtered.map((m) => m.companyName))
        .size;

      const { summaryExtras = {}, contentExtras = [] } =
        afterFetch?.({ rows }) ?? {};

      const summary = {
        title,
        location,
        company: company ?? 'all',
        showing:
          filtered.length === 0
            ? '0 of 0'
            : `${offset + 1}–${offset + page.length} of ${filtered.length}`,
        companiesSearched: companiesCount,
        companiesWithMatches,
        daysAgo: effectiveDaysAgo,
        runAt: runDate.toISOString(),
        ...(filtered.length > offset + limit && { nextOffset: offset + limit }),
        ...summaryExtras,
      };

      const table = rows.length
        ? buildMarkdownTable(csvColumns, rows)
        : '_No matching jobs found._';

      const content = [
        { type: 'text', text: JSON.stringify(summary, null, 2) },
        { type: 'text', text: table },
        ...contentExtras,
      ];

      return { content };
    } catch (error) {
      console.error('error in getJobs', error);
      return {
        content: [{ type: 'text', text: `Error fetching jobs from ${name}` }],
      };
    }
  };
}

export function buildToolSchema(defaultDaysAgo) {
  return z.object({
    title: z
      .string()
      .describe(
        'Job title to search for (case-insensitive substring, e.g. "senior software engineer", "backend", "data engineer").',
      ),
    location: z
      .string()
      .describe(
        'Location to filter by — city, country, or "remote" (e.g. "San Francisco", "United States", "London", "remote"). Always required.',
      ),
    company: z
      .string()
      .optional()
      .describe(
        'Filter by company name (case-insensitive substring). Omit to search all companies.',
      ),
    daysAgo: z
      .number()
      .int()
      .positive()
      .max(365)
      .optional()
      .describe(
        `Only include jobs published within this many days. Defaults to ${defaultDaysAgo}.`,
      ),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe(
        'Max results to return (default 20). Use with offset for pagination.',
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Number of results to skip (default 0). Check nextOffset in the summary to paginate.',
      ),
  });
}
