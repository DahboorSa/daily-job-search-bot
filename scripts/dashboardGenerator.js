import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { escapeHtml, safeUrl, jsonForScript } from './htmlUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_PATH = join(__dirname, '..', 'data', 'dashboard.html');
const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'dashboard.html');

const STATUS_CONFIG = {
  new:           { label: 'New',            color: '#1F4E79', bg: '#e8f0fe' },
  saved:         { label: 'Saved',          color: '#7B3F00', bg: '#fff3e0' },
  applied:       { label: 'Applied',        color: '#1B5E20', bg: '#e8f5e9' },
  rejected:      { label: 'Rejected',       color: '#7f0000', bg: '#ffebee' },
  accepted:      { label: 'Accepted',       color: '#004D40', bg: '#e0f2f1' },
  not_interested:{ label: 'Not Interested', color: '#555555', bg: '#f0f0f0' },
};

function scoreColor(score) {
  if (score >= 80) return '#27ae60';
  if (score >= 65) return '#e67e22';
  return '#e74c3c';
}

function renderJobCard(job, index) {
  const score = job.matchScore ?? 0;
  const status = job.status ?? 'new';
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;

  const statusOptions = Object.entries(STATUS_CONFIG)
    .map(([val, { label }]) =>
      `<option value="${val}"${val === status ? ' selected' : ''}>${label}</option>`,
    )
    .join('');

  const skillBadges = (job.topSkills ?? [])
    .map(
      (s) =>
        `<span style="background:#1F4E79;color:white;padding:2px 10px;border-radius:12px;font-size:12px;margin-right:4px;display:inline-block;margin-bottom:4px;">${escapeHtml(s)}</span>`,
    )
    .join('');

  const addedDate = job.addedAt
    ? new Date(job.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return `
  <div class="job-card" id="card-${index}" style="border-left: 4px solid ${cfg.color};">
    <div class="card-header">
      <div>
        <h3>${escapeHtml(job.title ?? 'N/A')}</h3>
        <p class="meta">
          <strong>${escapeHtml(job.company ?? 'N/A')}</strong> &nbsp;·&nbsp;
          ${escapeHtml(job.location ?? '')} &nbsp;·&nbsp; ${escapeHtml(job.jobType ?? 'Full-time')}
          ${addedDate ? `&nbsp;·&nbsp; Found ${addedDate}` : ''}
        </p>
      </div>
      <div class="score-badge" style="background:${scoreColor(score)};">${score}</div>
    </div>

    <div class="card-grid">
      <div class="info-box">
        <div class="info-label">💰 Job Salary</div>
        <div class="info-value">${escapeHtml(job.salary ?? 'Not specified')}</div>
      </div>
      ${job.salaryRange ? `<div class="info-box">
        <div class="info-label">📊 Avg Market Salary</div>
        <div class="info-value">${escapeHtml(job.salaryRange)}</div>
      </div>` : ''}
    </div>

    <div class="match-box">
      <div class="info-label">🎯 Why You Match</div>
      <p>${escapeHtml(job.matchReason ?? '')}</p>
    </div>

    <div style="margin-top:10px;">
      <div class="info-label" style="margin-bottom:6px;">🔑 Top Skills</div>
      ${skillBadges}
    </div>

    <div class="card-footer">
      <div class="status-wrap">
        <label for="status-${index}">Status:</label>
        <select id="status-${index}" class="status-select" data-index="${index}"
                style="background:${cfg.bg};color:${cfg.color};border-color:${cfg.color};"
                onchange="updateStatus(${index}, this)">
          ${statusOptions}
        </select>
      </div>
      <div class="action-btns">
        <a href="${safeUrl(job.applyUrl)}" target="_blank" class="btn btn-apply">✅ Apply</a>
        <a href="${safeUrl(job.linkedinUrl)}" target="_blank" class="btn btn-linkedin">🔗 LinkedIn</a>
        ${job.resumeFilename && job.resumeFilename !== 'N/A — resume generation disabled'
          ? `<span class="resume-tag">📎 ${escapeHtml(job.resumeFilename)}</span>`
          : ''}
      </div>
    </div>
  </div>`;
}

export function generateDashboard(jobs) {
  mkdirSync(join(__dirname, '..', 'data'), { recursive: true });

  const statusCounts = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map((k) => [k, 0]),
  );
  for (const job of jobs) {
    const s = job.status ?? 'new';
    if (s in statusCounts) statusCounts[s]++;
  }

  const sortedJobs = jobs
    .slice()
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

  const statPills = Object.entries(statusCounts)
    .map(([k, count]) => {
      const cfg = STATUS_CONFIG[k];
      return `<div class="stat-pill" data-status="${k}" data-label="${cfg.label}" style="background:${cfg.bg};color:${cfg.color};">${cfg.label}: ${count}</div>`;
    })
    .join('\n  ');

  const filterButtons = Object.entries(statusCounts)
    .map(([k, count]) =>
      `<button class="filter-btn" data-status="${k}" data-label="${STATUS_CONFIG[k].label}" onclick="filterJobs('${k}', this)">${STATUS_CONFIG[k].label} (${count})</button>`,
    )
    .join('\n  ');

  const template = readFileSync(TEMPLATE_PATH, 'utf-8');
  const html = template
    .replace('{{LAST_UPDATED}}', () => new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
    .replace('{{TOTAL_JOBS}}', () => `${jobs.length} total job${jobs.length !== 1 ? 's' : ''}`)
    .replace('{{STAT_PILLS}}', () => statPills)
    .replace('{{TOTAL_COUNT}}', () => String(jobs.length))
    .replace('{{FILTER_BUTTONS}}', () => filterButtons)
    .replace('{{JOB_CARDS}}', () => sortedJobs.map((job, i) => renderJobCard(job, i)).join(''))
    .replace('{{JOBS_JSON}}', () => jsonForScript(sortedJobs))
    .replace('{{STATUS_CFG_JSON}}', () => jsonForScript(
      Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, { color: v.color, bg: v.bg }]))
    ));

  writeFileSync(DASHBOARD_PATH, html);
  console.log(`   📊 Dashboard saved: data/dashboard.html`);
}
