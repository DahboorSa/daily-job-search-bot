import 'dotenv/config';

import { readFileSync, writeFileSync } from 'fs';
import mammoth from 'mammoth';

const RESUME_DERIVED_FIELDS = [
  'personal',
  'skills',
  'experience',
  'education',
  'certifications',
];

// 1. Read file path from args
// 2. Extract text from DOCX using mammoth
// 3. Send text to Groq API
// 4. Parse response as JSON
// 5. Write to config/profile.json

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
  console.log('📄 Generating Profile.json...');
  const CONFIG_PATH = 'config/profile.json';
  const filePath = process.argv[2];
  try {
    if (filePath) {
      let resumeText;
      await mammoth
        .extractRawText({ path: filePath })
        .then(function (result) {
          resumeText = result.value;
        })
        .catch((err) => {
          console.error('❌ Error:', err);
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
          console.error('❌ groq API error:', data.error);
          return;
        }
        const choice = data.choices[0];
        const newFields = choice.message.content;
        if (!newFields) {
          console.error(
            `❌ Empty response from model (finish_reason: ${choice.finish_reason}). Try raising max_completion_tokens.`,
          );
          return;
        }
        const merged = { ...profile, ...JSON.parse(newFields) };
        writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
        console.log('✅ Profile.json generated', newFields);
      }
    }
  } catch (err) {
    console.error('❌ generate profile failed:', err);
  }
}

generateProfile();
