# data/

This folder is auto-created at runtime. All files here are git-ignored (except this README).

| File | Description |
| ---- | ----------- |
| `searched_jobs.json` | Tracks seen job IDs to prevent duplicate alerts across runs |
| `jobs.json` | All matched jobs with their status (New, Saved, Applied, Rejected, Accepted, Not Interested) |
| `dashboard.html` | Local job tracker dashboard — open in browser to manage job statuses |
| `ashby_jobs_record.csv` | Latest export from the Ashby MCP server (`npm run mcp:ashby`), if used |
| `greenhouse_jobs_record.csv` | Latest export from the Greenhouse MCP server (`npm run mcp:greenhouse`), if used |

> To reset and start fresh, delete all files in this folder.
