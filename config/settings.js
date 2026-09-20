// Bot settings — tune these to change how the bot behaves each run

// Minimum match score (0–100): lower = more results, higher = stronger matches
export const MIN_MATCH_SCORE = 50;

// Max jobs processed per day, highest scores first (keep low while GENERATE_RESUMES = true)
export const MAX_JOBS_PER_RUN = 5;

// Set to false to skip .docx resumes (the email report still sends, without attachments)
export const GENERATE_RESUMES = true;

// How recent jobs to fetch: "today", "3days", "week" or "month"
export const DATE_POSTED = '3days';

// Set to false to skip the daily email (the dashboard still updates)
export const SEND_EMAIL = true;

// Set to false to skip Glassdoor calls (saves your monthly API limit)
export const FETCH_GLASSDOOR = true;

// Set to false to skip Ashby company boards (see scripts/ashbyClient.js)
export const FETCH_ASHBY = true;

// How many days back to look for Ashby postings
export const ASHBY_DAYS_AGO = 7;

// Set to false to skip Greenhouse company boards (see scripts/greenhouseClient.js)
export const FETCH_GREENHOUSE = true;

// How many days back to look for Greenhouse postings
export const GREENHOUSE_DAYS_AGO = 7;
