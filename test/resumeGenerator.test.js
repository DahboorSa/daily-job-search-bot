import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateResumeForJob } from '../scripts/resumeGenerator.js';
import { silenceConsole } from './helpers.js';

const profile = {
  personal: { name: 'Test User', phone: '555', email: 't@example.com', location: 'Austin, TX' },
  skills: {
    backend: ['Node.js'], languages: ['JS'], databases: ['Postgres'], orm: ['Prisma'],
    event_streaming: ['Kafka'], testing: ['Jest'], architecture: ['REST'], ci_cd: ['GitHub Actions'],
    monitoring: ['Datadog'], ai_tools: ['Claude'], agile: ['Scrum'],
  },
  experience: [],
  education: { degree: 'BS', school: 'U', location: 'TX', gpa: '4.0' },
  certifications: [],
  search_config: { summaries: { default: 'Summary' } },
};
const analysis = { dominantTheme: 'default', matchScore: 80, topSkills: ['Node.js'], matchedKeywords: ['node'] };

test('generateResumeForJob writes a docx and avoids overwriting duplicates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resume-'));
  const restore = silenceConsole();
  try {
    const job = { company: 'Acme, Inc.', title: 'Backend/Engineer' };
    const first = await generateResumeForJob(profile, job, analysis, dir);
    const second = await generateResumeForJob(profile, job, analysis, dir);

    assert.equal(first.filename, 'Resume_Acme__Inc__Backend_Engineer.docx');
    assert.equal(second.filename, 'Resume_Acme__Inc__Backend_Engineer_2.docx');
    assert.ok(existsSync(first.filePath));
    assert.equal(readFileSync(first.filePath).subarray(0, 2).toString(), 'PK'); // docx is a zip
  } finally {
    restore();
    rmSync(dir, { recursive: true, force: true });
  }
});
