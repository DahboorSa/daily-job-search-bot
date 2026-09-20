import 'dotenv/config';

import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import mammoth from 'mammoth';
import { z } from 'zod';

const RESUME_DERIVED_FIELDS = [
  'personal',
  'skills',
  'experience',
  'education',
  'certifications',
];

// Shape the bot expects; invalid model output never overwrites the profile
const optionalText = z.union([z.string(), z.number()]).nullable().optional();
// looseObject keeps extra keys
const resumeFieldsSchema = z.object({
  personal: z.looseObject({
    name: z.string().min(1),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
  }),
  skills: z.record(z.string(), z.array(z.string())),
  experience: z
    .array(
      z.looseObject({
        title: z.string(),
        company: z.string(),
        location: z.string(),
        dates: z.string(),
        client: optionalText,
        bullets: z.array(z.string()),
      }),
    )
    .min(1),
  education: z.looseObject({
    degree: z.string(),
    school: z.string(),
    location: z.string(),
    gpa: optionalText,
  }),
  certifications: z.array(z.string()),
});

async function callGroqWithRetry(body, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    if (response.status === 429 && attempt < retries) {
      const waitSec =
        Number(data.error?.message?.match(/try again in ([\d.]+)s/)?.[1]) || 5;
      console.warn(`⏳ Rate limited, retrying in ${waitSec}s...`);
      await new Promise((r) => setTimeout(r, waitSec * 1000 + 500));
      continue;
    }
    return data;
  }
}

async function generateProfile() {
  console.log('📄 Parsing resume...');
  const CONFIG_PATH = 'config/profile.json';
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('❌ Usage: npm run setup path/to/your/resume.docx');
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY is not set — add it to your .env file.');
    return;
  }
  try {
    if (filePath) {
      let resumeText;
      await mammoth
        .extractRawText({ path: filePath })
        .then(function (result) {
          resumeText = result.value;
        })
        .catch((err) => {
          console.error(`❌ Couldn't read the resume: ${err.message}`);
        });

      if (resumeText) {
        const profile = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
        const template = Object.fromEntries(
          RESUME_DERIVED_FIELDS.map((key) => [key, profile[key]]),
        );

        const data = await callGroqWithRetry({
          model: 'openai/gpt-oss-20b',
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: `You are a resume parser. Extract information from the resume below and fill in the following JSON. Replace all example values with real values from the resume. Return only valid JSON, no extra text, no markdown, no code blocks.\n\nJSON to fill:\n${JSON.stringify(template, null, 2)}\n\nResume:\n${resumeText}`,
            },
          ],
          max_completion_tokens: 2048,
        });
        if (data.error) {
          console.error(`❌ Groq API error: ${data.error.message ?? JSON.stringify(data.error)}`);
          return;
        }
        const choice = data.choices?.[0];
        const newFields = choice?.message?.content;
        if (!newFields) {
          console.error(
            `❌ Empty model response (finish_reason: ${choice?.finish_reason}) — try raising max_completion_tokens`,
          );
          return;
        }
        const parsed = resumeFieldsSchema.safeParse(JSON.parse(newFields));
        if (!parsed.success) {
          const issues = parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; ');
          console.error(`❌ Unexpected model output, profile unchanged (${issues}). Run again.`);
          return;
        }
        // Backup so a bad parse can be undone
        copyFileSync(CONFIG_PATH, `${CONFIG_PATH}.bak`);
        const merged = { ...profile, ...parsed.data };
        writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
        console.log(`✅ profile.json updated (backup: ${CONFIG_PATH}.bak)`);
      } else if (resumeText === '') {
        console.error('❌ No text could be extracted from the resume file.');
      }
    }
  } catch (err) {
    console.error(`❌ Setup failed: ${err.message}`);
  }
}

generateProfile();
