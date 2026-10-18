// Bot settings — tune these to change how the bot behaves each run. See README → "Tune job results" for details.

// Minimum match score (0–100)
export const MIN_MATCH_SCORE = 50;

// Max jobs processed per day
export const MAX_JOBS_PER_RUN = 5;

// Generate a tailored .docx resume per match
export const GENERATE_RESUMES = true;

// How recent jobs to fetch: "today", "3days", "week" or "month"
export const DATE_POSTED = '3days';

// Search JSearch (Indeed/LinkedIn/Glassdoor aggregator)
export const FETCH_JSEARCH = true;

// Send the daily email report
export const SEND_EMAIL = true;

// Look up Glassdoor salary data
export const FETCH_GLASSDOOR = true;

// Search Ashby company boards
export const FETCH_ASHBY = true;

// How many days back to look for Ashby postings
export const ASHBY_DAYS_AGO = 7;

// Search Greenhouse company boards
export const FETCH_GREENHOUSE = true;

// How many days back to look for Greenhouse postings
export const GREENHOUSE_DAYS_AGO = 7;
