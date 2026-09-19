// ─── Bot Settings ───────────────────────────────────────────────
// ✏️  Tune these to control how the bot behaves each run

// Minimum match score to include a job (0–100)
// Lower = more results but less relevant
// Higher = fewer results but stronger matches
export const MIN_MATCH_SCORE = 50;

// Max jobs to process per day
// Keep low when GENERATE_RESUMES = true (each resume takes time to generate)
// Raise it when GENERATE_RESUMES = false (just email, no file generation)
export const MAX_JOBS_PER_RUN = 5;

// Set to false to skip .docx resume generation
// You'll still get the full email report — just no attachments
export const GENERATE_RESUMES = true;

// How recent jobs to fetch from the API
// Valid values: "today", "3days", "week", "month"
export const DATE_POSTED = '3days';

// Set to false to skip sending the daily email report
// The dashboard will still be updated regardless of this setting
export const SEND_EMAIL = true;

// Set to false to skip Glassdoor API calls (rating + salary)
// Useful when you're close to your monthly API limit
export const FETCH_GLASSDOOR = true;

// Set to false to skip searching Ashby-hosted job boards (see scripts/ashbyClient.js)
export const FETCH_ASHBY = true;

// How many days back to look for Ashby job postings
export const ASHBY_DAYS_AGO = 7;
