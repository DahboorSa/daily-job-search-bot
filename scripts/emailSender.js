import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';

function buildHtmlReport(jobs, dateStr) {
  const jobCards = jobs
    .map((job, i) => {
      const score = job.matchScore ?? 0;
      const scoreColor =
        score >= 80 ? '#27ae60' : score >= 65 ? '#e67e22' : '#e74c3c';

      const skillBadges = (job.topSkills ?? [])
        .map(
          (s) =>
            `<span style="background:#1F4E79;color:white;padding:3px 10px;border-radius:12px;` +
            `font-size:12px;margin-right:6px;display:inline-block;margin-bottom:4px;">${s}</span>`,
        )
        .join('');

      return `
    <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;
                padding:20px;margin-bottom:20px;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <h2 style="margin:0 0 4px 0;color:#1F4E79;font-size:18px;">
            ${i + 1}. ${job.title ?? 'N/A'}
          </h2>
          <p style="margin:0;color:#555;font-size:14px;">
            <strong>${job.company ?? 'N/A'}</strong> &nbsp;·&nbsp;
            ${job.location ?? ''} &nbsp;·&nbsp; ${job.jobType ?? 'Full-time'}
            ${job.postedAt ? `&nbsp;·&nbsp; Posted ${new Date(job.postedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </td>
        <td align="right" valign="top">
          <div style="background:${scoreColor};color:white;border-radius:50%;
                      width:52px;height:52px;text-align:center;line-height:52px;
                      font-size:16px;font-weight:bold;">${score}</div>
        </td>
      </tr></table>

      <div style="margin-top:12px;padding:12px;background:#f8f9fa;border-radius:6px;">
        <p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">💰 Salary</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#2E2E2E;">${job.salary ?? 'Not specified'}</p>
      </div>

      <div style="margin-top:12px;padding:12px;background:#f0f4ff;border-radius:6px;">
        <p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">🎯 Why You Match</p>
        <p style="margin:0;font-size:14px;color:#2E2E2E;line-height:1.5;">${job.matchReason ?? ''}</p>
      </div>

      <div style="margin-top:12px;">
        <p style="margin:0 0 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">🔑 Top Skills to Highlight</p>
        ${skillBadges}
      </div>

      <div style="margin-top:16px;">
        <a href="${job.applyUrl ?? '#'}"
           style="background:#1F4E79;color:white;padding:8px 18px;border-radius:5px;
                  text-decoration:none;font-size:13px;font-weight:600;margin-right:8px;">
          ✅ Apply Now
        </a>
        <a href="${job.linkedinUrl ?? '#'}"
           style="background:#0077B5;color:white;padding:8px 18px;border-radius:5px;
                  text-decoration:none;font-size:13px;font-weight:600;">
          🔗 LinkedIn
        </a>
      </div>

      <p style="margin-top:12px;margin-bottom:0;font-size:12px;color:#888;">
        📎 Tailored resume attached: <em>${job.resumeFilename ?? ''}</em>
      </p>
    </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:680px;margin:0 auto;padding:20px;">

    <div style="background:linear-gradient(135deg,#1F4E79,#2980b9);color:white;
                border-radius:10px;padding:28px;margin-bottom:24px;text-align:center;">
      <h1 style="margin:0 0 8px 0;font-size:24px;">🤖 Daily Job Hunt Report</h1>
      <p style="margin:0;opacity:0.85;font-size:15px;">${dateStr}</p>
      <p style="margin:8px 0 0 0;font-size:14px;opacity:0.75;">
        Found <strong>${jobs.length}</strong> matching role${jobs.length !== 1 ? 's' : ''} today
      </p>
    </div>

    ${
      jobs.length > 0
        ? jobCards
        : `<p style="text-align:center;color:#888;padding:40px 0;">
           No new matching jobs found today. Check back tomorrow! 👀
         </p>`
    }

    <div style="text-align:center;color:#aaa;font-size:12px;margin-top:20px;
                padding-top:16px;border-top:1px solid #ddd;">
      <p>Generated automatically by your Job Hunt Bot 🤖<br>
      Powered by GitHub Actions · 100% Free</p>
    </div>
  </div>
</body></html>`;
}

/**
 * Send the daily report via Gmail SMTP.
 * Env vars required: GMAIL_SENDER, GMAIL_APP_PASSWORD, GMAIL_RECIPIENT
 */
export async function sendDailyReport(jobs, resumeFiles) {
  const sender = process.env.GMAIL_SENDER;
  const password = process.env.GMAIL_APP_PASSWORD;
  const recipient = process.env.GMAIL_RECIPIENT ?? sender;

  if (!sender || !password) {
    throw new Error('GMAIL_SENDER and GMAIL_APP_PASSWORD must be set.');
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const attachments = resumeFiles
    .filter((f) => existsSync(f))
    .map((f) => ({
      filename: basename(f),
      content: readFileSync(f),
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }));

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: sender, pass: password },
  });

  const subject = `🤖 Job Hunt Report — ${jobs.length} Match${jobs.length !== 1 ? 'es' : ''} Found · ${dateStr}`;

  await transporter.sendMail({
    from: `Job Hunt Bot <${sender}>`,
    to: recipient,
    subject,
    html: buildHtmlReport(jobs, dateStr),
    attachments,
  });

  console.log(`✅ Email sent successfully!`);
}
