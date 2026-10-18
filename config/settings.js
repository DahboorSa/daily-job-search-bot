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

// How many days back to look for postings on all company job boards
export const DAYS_AGO = 7;

// Search Ashby company boards
export const FETCH_ASHBY = true;

// Search Greenhouse company boards
export const FETCH_GREENHOUSE = true;

// Search Lever company boards
export const FETCH_LEVER = true;

// Search SmartRecruiters company boards
export const FETCH_SMARTRECRUITERS = true;

// Search Gem company boards
export const FETCH_GEM = true;
