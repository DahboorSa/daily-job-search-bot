# 🤖 Daily Job Search Bot

### Automated job search + tailored resume generator — runs every morning while you sleep

![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat&logo=nodedotjs)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Automated-2088FF?style=flat&logo=githubactions)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![Cost](https://img.shields.io/badge/Cost-%240%2Fmonth-brightgreen?style=flat)

---

## 📸 Preview

**Daily Email Report**

![Daily Email Report](assets/job-search-email.png)

**Job Tracker Dashboard**

![Job Tracker Dashboard](assets/job-dashboard.png)

---

## 🎯 What It Does

Every weekday morning, this bot automatically:

1. 🔍 **Searches job boards** (Indeed, LinkedIn, Glassdoor & more) for new jobs matching your profile
2. 🏢 **Searches ~130 top tech companies' own career pages** directly (OpenAI, Notion, Ramp, Linear, Cursor & more via Ashby-hosted boards) — catches roles before they hit the aggregators. Greenhouse-hosted boards (Stripe, Airbnb, Figma & more) are available through the optional MCP server (see below)
3. 🎯 **Scores each job** by how well it matches your skills (0–100)
4. 📄 **Generates a tailored `.docx` resume** for every strong match
5. 🔗 **Generates a LinkedIn search link** for each company
6. 📊 **Fetches average market salary** for each role via Glassdoor
7. 📬 **Emails you a beautiful report** with all resumes attached — ready to apply!
8. 📋 **Generates a local dashboard** (`data/dashboard.html`) to track job statuses (New, Saved, Applied, Rejected, Accepted, Not Interested)

You wake up, open your email, and your job search is already done. ☕

---

## 💰 Cost

| Service             | Plan                                                      | Cost         |
| ------------------- | --------------------------------------------------------- | ------------ |
| GitHub Actions      | Free (2,000 min/month)                                    | **$0**       |
| RapidAPI JSearch    | Free tier — aggregates Indeed, LinkedIn, Glassdoor & more | **$0**       |
| RapidAPI Glassdoor  | Free tier — average market salary insights                | **$0**       |
| Ashby Job Board API | Free, no key needed — direct company career pages         | **$0**       |
| Greenhouse Job Board API | Free, no key needed — direct company career pages (MCP server) | **$0**  |
| Gmail SMTP          | Free                                                      | **$0**       |
| Groq (optional)     | Free tier — one-time resume → `profile.json` generation   | **$0**       |
| **Total**           |                                                           | **$0/month** |

> ⚠️ Watch your monthly request limit on the free tier.
> Want more searches? [Check JSearch pricing](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch/pricing) to upgrade.

---

## 🚀 Setup Guide (~20 minutes, one time only)

### Step 1 — Create your own **private** copy of this repository

> 🔒 **Keep your copy private.** `config/profile.json` holds your name, email, phone number and work history, and the workflow reads it straight from the repo. A public repo exposes all of it — and rewriting git history later doesn't fully remove it (forks, clones and caches keep old commits).
>
> GitHub does not let you make a fork of a public repo private, so don't rely on **Fork → Private**. Instead, create a new **private** repository on GitHub, then clone this project and push it there:
>
> ```bash
> git clone https://github.com/dahboorSa/daily-job-search-bot.git
> cd daily-job-search-bot
> git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_PRIVATE_REPO.git
> git push -u origin main
> ```
>
> Also set a git identity before committing (`git config --global user.name` / `user.email`, ideally your GitHub `ID+username@users.noreply.github.com` address), otherwise git guesses one from your computer's username and hostname. Don't commit your resume file (`config/resume.docx`) either.

### Step 2 — Fill in your profile

#### Option A — Auto-generate from your resume (recommended)

```bash
npm install
cp .env.example .env
# Add a free Groq API key from https://console.groq.com/keys to .env as GROQ_API_KEY

npm run setup path/to/your/resume.docx
```

This parses your `.docx` resume and fills in `personal`, `skills`, `experience`, `education`, and `certifications` in `config/profile.json` for you (`job_preferences` and `search_config` are left untouched — see Option B for those). Review the result, then keep going.

> ⚠️ The full text of your resume is sent to Groq's API to be parsed, and the command **overwrites** those five fields in `config/profile.json`. Only `.docx` files are supported.
>
> The model's reply is checked against the shape the bot expects (e.g. `education` must be a single object, `experience` a list). If it doesn't match, `profile.json` is left untouched — just run the command again.

#### Option B — Fill it in by hand

Edit `config/profile.json` with your own information — the file is fully commented with example values. Key fields:

```json
{
  "personal": { "name": "John Smith", "email": "john@gmail.com", "..." },

  "skills": {
    "backend": ["Node.js", "NestJS", "..."],
    "languages": ["TypeScript", "Python", "..."]
  },

  "experience": [
    {
      "title": "Senior Software Engineer",
      "company": "Company Name",
      "dates": "Jan 2023 – Present",
      "bullets": ["Built X using Y...", "..."]
    }
  ],

  "job_preferences": {
    "search_titles": ["Senior Software Engineer", "Senior Backend Engineer"],
    "locations": ["New York, NY", "remote"],
    "min_salary": 130000,
    "title_include": ["senior", "lead", "..."],
    "title_exclude": ["junior", "intern", "..."]
  },

  "search_config": {
    "themes": {
      "payments": {
        "keywords": ["payment", "billing", "..."],
        "skills": ["Node.js", "Kafka", "..."],
        "score": 10
      }
    },
    "summaries": { "payments": "Your payments-focused summary...", "default": "Your general summary..." },
    "match_reasons": { "payments": "Your X years in payments aligns with...", "default": "..." }
  }
}
```

> 💡 **Tips:**
>
> - `experience.bullets` — use action verbs and add numbers/metrics where possible (%, $, users, etc.). The bot reorders them per job to highlight the most relevant ones first.
> - `min_salary` — jobs below this value are filtered out automatically.
> - `title_include` — (optional) job title must contain at least one of these words to be included. Omit the field entirely to skip this filter.
> - `title_exclude` — jobs with any of these words in the title are filtered out.
> - `client` — set to `null` for direct employment, or add client name if consulting.
> - `search_config` — controls how jobs are themed, scored, and summarized. See the "Personalize the search engine" section below.

---

### Step 3 — Get your free API keys

#### A. RapidAPI Key (JSearch + Glassdoor)

1. Sign up free at [rapidapi.com](https://rapidapi.com)
2. Search **"JSearch"** → Subscribe to the **Free plan**
3. Search **"Real-Time Glassdoor Data"** → Subscribe to the **Free plan**
4. Go to **My Apps → Application Keys** → copy your key (one key works for both APIs!)

> 📍 Can't find the key? Go to the JSearch page → look for `"X-RapidAPI-Key"` in the Code Snippets panel on the right

#### B. Gmail App Password

1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security**
2. Enable **2-Step Verification** (required!)
3. Search **"App Passwords"** → Generate one → name it `JobBot`
4. Copy the 16-character code and paste it as your secret value

### Step 4 — Add secrets to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name          | Value                             |
| -------------------- | --------------------------------- |
| `RAPIDAPI_KEY`       | Your RapidAPI key                 |
| `GMAIL_SENDER`       | Your Gmail address                |
| `GMAIL_APP_PASSWORD` | 16-char App Password              |
| `GMAIL_RECIPIENT`    | Where to receive the daily report |

### Step 5 — Enable the daily schedule

The workflow is already included in the repo. To enable automatic daily runs, uncomment the schedule in `.github/workflows/daily_job_search.yml`:

```yaml
on:
  # ✏️ Uncomment the lines below to enable daily scheduling
  # schedule:
  #   - cron: '0 13 * * 1-5' # Mon–Fri 9:00 AM EDT / 8:00 AM EST (UTC-based, always)
  workflow_dispatch:
```

### Step 6 — Test it now!

1. **Actions** tab → **"🤖 Daily Job Search"**
2. **"Run workflow"** → **"Run workflow"**
3. Watch the logs (~3 minutes) → check your inbox! 📬

---

## ⚙️ Customizing

### 🌍 Change locations and job titles

Edit `search_titles` and `locations` in `config/profile.json` — the bot automatically searches every title × location combination:

```json
"job_preferences": {
  "search_titles": ["Senior Software Engineer", "Senior Backend Engineer"],
  "locations": ["New York, NY", "remote"]
}
```

> The example above generates 4 searches (2 titles × 2 locations).

Supported countries:

| Country           | Include in location string  |
| ----------------- | --------------------------- |
| 🇺🇸 United States  | `"New York NY"`, `"remote"` |
| 🇯🇴 Jordan         | `"Amman Jordan"`            |
| 🇸🇦 Saudi Arabia   | `"Riyadh Saudi Arabia"`     |
| 🇬🇧 United Kingdom | `"London UK"`               |
| 🇨🇦 Canada         | `"Toronto Canada"`          |
| 🇦🇺 Australia      | `"Sydney Australia"`        |
| 🇩🇪 Germany        | `"Berlin Germany"`          |
| 🇫🇷 France         | `"Paris France"`            |
| 🇮🇳 India          | `"Bangalore India"`         |

### Tune job results

Edit `config/settings.js`:

```js
// Minimum match score (0–100): lower = more results, higher = stronger matches
export const MIN_MATCH_SCORE = 50;

// Max jobs processed per day, highest scores first (keep low while GENERATE_RESUMES = true)
export const MAX_JOBS_PER_RUN = 5;

// Set to false to skip .docx resumes (the email report still sends, without attachments)
export const GENERATE_RESUMES = true;

// How recent jobs to fetch: "today", "3days", "week" or "month"
export const DATE_POSTED = "3days";

// Set to false to skip the daily email (the dashboard still updates)
export const SEND_EMAIL = true;

// Set to false to skip Glassdoor calls (saves your monthly API limit)
export const FETCH_GLASSDOOR = true;

// Set to false to skip Ashby company boards (see scripts/ashbyClient.js)
export const FETCH_ASHBY = true;

// How many days back to look for Ashby postings
export const ASHBY_DAYS_AGO = 7;
```

### 🏢 Add or remove companies from the Ashby search

`scripts/ashbyCompanies.js` exports a plain array of company board slugs (the part of `jobs.ashbyhq.com/<slug>`). Add a company by appending its slug, or trim the list to just the companies you care about — fewer companies means a faster run.

### 🌱 Add or remove companies from the Greenhouse search

`scripts/greenhouseCompanies.js` works the same way, with Greenhouse board tokens (the part of `job-boards.greenhouse.io/<token>`). To check a token before adding it, open `https://boards-api.greenhouse.io/v1/boards/<token>/jobs` in a browser — a working board returns JSON, a wrong token returns 404. The list is a starter set, not an official directory.

### 🎯 Personalize the search engine

All customizable data lives in **one file** — `config/profile.json`, under the `search_config` key.
You don't need to touch any script files to personalize the bot!

The `search_config` section has 3 fields — each clearly marked with what to change:

| Field           | What it controls                                                          |
| --------------- | ------------------------------------------------------------------------- |
| `themes`        | Keywords to detect job type + skills to highlight per theme (all-in-one!) |
| `summaries`     | Your professional summary shown at the top of each resume                 |
| `match_reasons` | "Why You Match" text shown in your email report                           |

Example — personalizing `match_reasons`:

```json
"match_reasons": {
  "payments": "Your X years in payments/fintech at [Company] handling X transactions/day aligns with this role.",
  "eventDriven": "Your Kafka/event-driven work at [Company] reducing processing time by X% matches this role's focus.",
  "devex": "Your CI/CD and platform engineering experience at [Company] improving deploy speed by X% fits this role.",
  "default": "Your engineering background matches several key requirements in this job description."
}
```

### Change the schedule time

Once enabled, you can adjust the timing in `.github/workflows/daily_job_search.yml`:

```yaml
on:
  # ✏️ Uncomment the lines below to enable daily scheduling
  # schedule:
  #   - cron: '0 13 * * 1-5' # Mon–Fri 9:00 AM EDT / 8:00 AM EST (UTC-based, always)
  workflow_dispatch: # manual trigger always stays on
```

Common schedule options (GitHub Actions cron always runs in **UTC**):

```yaml
# Format: minute hour * * days (1-5 = Mon–Fri)
- cron: "0 14 * * 1-5" # 9:00 AM EST / 10:00 AM EDT
- cron: "30 13 * * 1-5" # 8:30 AM EST / 9:30 AM EDT
- cron: "0 9 * * 1-5" # 9:00 AM UTC (adjust for your timezone)
- cron: "0 14 * * *" # 9:00 AM EST every day including weekends
```

---

## 📁 Project Structure

```
daily-job-search-bot/
├── .github/
│   └── workflows/
│       └── daily_job_search.yml    # GitHub Actions scheduler
├── scripts/
│   ├── jobSearch.js                # Main orchestrator
│   ├── searchEngine.js             # Matching logic (don't edit)
│   ├── resumeGenerator.js          # Builds tailored .docx resumes
│   ├── emailSender.js              # Gmail HTML report sender
│   ├── glassdoorClient.js          # Glassdoor rating & salary insights
│   ├── ashbyClient.js              # Fetches + filters jobs from Ashby-hosted company boards
│   ├── ashbyCompanies.js           # ✏️ List of company slugs to search on Ashby
│   ├── ashbyMcpServer.js           # Standalone MCP server exposing Ashby search as an agent tool
│   ├── greenhouseClient.js         # Fetches + filters US engineering jobs from Greenhouse-hosted boards
│   ├── greenhouseCompanies.js      # ✏️ List of board tokens to search on Greenhouse
│   ├── greenhouseMcpServer.js      # Standalone MCP server exposing Greenhouse search as an agent tool
│   ├── mcpJobsServer.js            # Shared MCP server logic (tool, CSV export) used by both servers above
│   ├── htmlUtils.js                # HTML/JSON escaping for job text in the email and dashboard
│   ├── setupProfile.js             # Parses a .docx resume into config/profile.json via Groq
│   ├── jobsTracker.js              # Persists all jobs to data/jobs.json
│   ├── dashboardGenerator.js       # Generates static HTML dashboard
│   ├── generateDashboard.js        # CLI entry point to rebuild the dashboard from saved data
│   └── dashboardClient.js          # Dashboard browser-side JS
├── templates/
│   └── dashboard.html              # Dashboard HTML/CSS template
├── config/
│   ├── profile.json                # ✏️ Your personal data, skills, experience & search config
│   └── settings.js                 # ✏️ Bot tunables: score threshold, max jobs, resumes on/off
├── data/
│   ├── searched_jobs.json          # Auto-created: no duplicate alerts
│   ├── jobs.json                   # Auto-created: all tracked jobs with status
│   ├── ashby_jobs_record.csv       # Auto-created: latest Ashby MCP server run, if used
│   ├── greenhouse_jobs_record.csv  # Auto-created: latest Greenhouse MCP server run, if used
│   └── dashboard.html              # Auto-created: open in browser to track jobs
├── output/
│   └── YYYY-MM-DD/                 # Auto-created: daily resume files
├── .env.example                    # Template for local testing
├── package.json
└── README.md
```

---

## 🧪 Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/daily-job-search-bot.git
cd daily-job-search-bot

# 2. Install dependencies
npm install

# 3. Set up local secrets
cp .env.example .env
# Edit .env with your keys

# 4. Run it!
npm start
```

Other useful commands:

```bash
npm run setup path/to/resume.docx   # (Re)generate config/profile.json from a resume
npm run dashboard                   # Rebuild data/dashboard.html from saved job data, without a full search
npm run mcp:ashby                   # Start the Ashby search as a standalone MCP server (see below)
npm run mcp:greenhouse              # Start the Greenhouse search as a standalone MCP server (see below)
```

---

## 🔌 Ashby & Greenhouse MCP Servers (optional)

### Ashby

`scripts/ashbyMcpServer.js` exposes the Ashby company-board search as a standalone [MCP](https://modelcontextprotocol.io) server, separate from the daily automated run. Point an MCP-compatible client (e.g. Claude Desktop or Claude Code) at it:

```json
{
  "mcpServers": {
    "ashby-jobs": {
      "command": "node",
      "args": ["scripts/ashbyMcpServer.js"]
    }
  }
}
```

It provides a `get_jobs` tool (filter by `daysAgo`) that writes matches to `data/ashby_jobs_record.csv` and exposes that file as a readable resource — handy for asking an agent "find me recent backend roles at OpenAI or Notion" outside the daily email flow.

### Greenhouse

`scripts/greenhouseMcpServer.js` is the same idea for Greenhouse-hosted boards:

```json
{
  "mcpServers": {
    "greenhouse-jobs": {
      "command": "node",
      "args": ["scripts/greenhouseMcpServer.js"]
    }
  }
}
```

Its `get_jobs` tool (filter by `daysAgo`) writes matches to `data/greenhouse_jobs_record.csv`. How it filters:

- **US only** — Greenhouse locations are free text like `Seattle, WA`, so it matches a US state code or an explicit `US` / `USA` / `United States`.
- **Engineering roles only** — the title must contain "software engineer" or "backend", and the department (when a job lists one) must be an engineering one.
- **Publish date** — uses `first_published`, not `updated_at`, so edited old postings don't reappear as new.
- **No salary column** — Greenhouse's board API doesn't expose pay ranges.

> ℹ️ Unlike Ashby, the Greenhouse search is **not** part of the daily automated run yet — it's only available through the MCP server.

---

## 🛠 Troubleshooting

| Problem                 | Fix                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| No email received       | Check Actions logs for ❌. Verify all 4 secrets are correct.                                           |
| "0 jobs found"          | Change `DATE_POSTED` in `config/settings.js` — valid values: `"today"`, `"3days"`, `"week"`, `"month"` |
| All scores too low      | Lower `MIN_MATCH_SCORE` in `config/settings.js`                                                        |
| RapidAPI limit hit      | Reduce searches or [upgrade your plan](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch/pricing) |
| Can't find App Password | Enable 2-Step Verification in Google Account first                                                     |
| Greenhouse board returns 404 | The token in `scripts/greenhouseCompanies.js` is wrong — check `boards-api.greenhouse.io/v1/boards/<token>/jobs` |

---

## 🗺 Roadmap

- [x] Indeed search via RapidAPI
- [x] Smart keyword-based resume tailoring
- [x] Tailored `.docx` resume per job
- [x] LinkedIn company page finder
- [x] Beautiful HTML email report
- [x] Deduplication (never see same job twice)
- [x] Global search support (US, Jordan, Saudi, UK...)
- [x] Resume generation toggle
- [x] Average market salary insights via Glassdoor (RapidAPI)
- [x] Job tracker dashboard (applied / saved / rejected / accepted / not interested)
- [x] Resume profile generator (upload your resume → auto-generate `config/profile.json`)
- [x] Direct company career page search via Ashby-hosted boards (~130 top tech companies)
- [x] Ashby search exposed as a standalone MCP server for agent use
- [x] Greenhouse board search (US engineering roles) exposed as a standalone MCP server
- [ ] Add Greenhouse to the daily automated run
- [ ] AI-powered job application package (tailored resume + cover letter per job)
- [ ] Automated job application submission
- [ ] Rejection detection via email parsing

---

## ⭐ Support

If this project helped you, please give it a **star on GitHub** —
it helps other developers find it and motivates me to keep improving it!

[![GitHub stars](https://img.shields.io/github/stars/dahboorSa/daily-job-search-bot?style=social)](https://github.com/dahboorSa/daily-job-search-bot)

---

## 👩‍💻 Author

Made with 🌸 by **Sebaa Dahboor**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Sebaa%20Dahboor-0077B5?style=flat&logo=linkedin)](https://www.linkedin.com/in/saba-dahboor/)

---

## 📄 License

MIT — free to use, modify, and share.
