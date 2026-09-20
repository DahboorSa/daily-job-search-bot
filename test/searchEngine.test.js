import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeJob, getSummary } from '../scripts/searchEngine.js';

const config = {
  themes: {
    backend: { keywords: ['node', 'postgres', 'kafka'], score: 20, skills: ['Node.js'] },
    ai: { keywords: ['llm'], score: 10, skills: ['LLMs'] },
    default: { keywords: [], score: 0, skills: ['General'] },
  },
  match_reasons: { backend: 'Backend fit.', default: 'General fit.' },
  summaries: { backend: 'Backend summary', default: 'Default summary' },
};

test('analyzeJob scores by matched keywords and picks the dominant theme', () => {
  const a = analyzeJob('Backend Engineer', 'Node and Postgres, some LLM work', config);
  assert.equal(a.dominantTheme, 'backend');
  assert.equal(a.matchScore, 63); // (20 + 20 + 10) / 80
  assert.deepEqual(a.matchedKeywords.sort(), ['llm', 'node', 'postgres']);
  assert.deepEqual(a.topSkills, ['Node.js']);
  assert.match(a.matchReason, /^Backend fit\. Key matched skills:/);
});

test('analyzeJob is case-insensitive and caps the score at 98', () => {
  const a = analyzeJob('NODE POSTGRES KAFKA', 'node postgres kafka llm', {
    ...config,
    themes: { ...config.themes, backend: { ...config.themes.backend, score: 100 } },
  });
  assert.equal(a.matchScore, 98);
});

test('analyzeJob falls back to default theme with no matches', () => {
  const a = analyzeJob('Chef', 'cooking', config);
  assert.equal(a.matchScore, 0);
  assert.equal(a.dominantTheme, 'default');
  assert.deepEqual(a.topSkills, ['General']);
  assert.equal(a.matchReason, 'General fit.');
});

test('getSummary returns the theme summary or the default', () => {
  assert.equal(getSummary({ dominantTheme: 'backend' }, config), 'Backend summary');
  assert.equal(getSummary({ dominantTheme: 'nope' }, config), 'Default summary');
});
