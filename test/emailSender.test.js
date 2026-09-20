import test from 'node:test';
import assert from 'node:assert/strict';
import { sendDailyReport, buildHtmlReport } from '../scripts/emailSender.js';

test('sendDailyReport requires Gmail credentials', async () => {
  const saved = { ...process.env };
  delete process.env.GMAIL_SENDER;
  delete process.env.GMAIL_APP_PASSWORD;
  try {
    await assert.rejects(() => sendDailyReport([], []), /GMAIL_SENDER and GMAIL_APP_PASSWORD/);
  } finally {
    process.env = saved;
  }
});

test('buildHtmlReport escapes job text', () => {
  const html = buildHtmlReport([{ title: '<script>alert(1)</script>', applyUrl: 'javascript:alert(1)' }], 'Today');
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('javascript:'));
});
