import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, normalizeGreenhouseJob } from '../scripts/greenhouseClient.js';

test('htmlToText decodes entities, strips tags and keeps paragraph breaks', () => {
  const input = '&lt;p&gt;R&amp;amp;D &amp;#8217;s &amp;mdash; ok&lt;/p&gt;&lt;p&gt;Two&lt;/p&gt;';
  assert.equal(htmlToText(input), 'R&D ’s — ok\nTwo');
});

test('htmlToText does not turn escaped text into tags', () => {
  assert.equal(htmlToText('&lt;p&gt;a &amp;lt;b&amp;gt; c&lt;/p&gt;'), 'a <b> c');
});

test('htmlToText handles hex entities and missing content', () => {
  assert.equal(htmlToText('it&#x27;s'), "it's");
  assert.equal(htmlToText(undefined), '');
});

test('normalizeGreenhouseJob maps fields and detects remote', () => {
  const job = normalizeGreenhouseJob({
    companyName: 'acme',
    job: {
      title: 'Backend Engineer',
      company_name: 'Acme',
      location: { name: 'Remote, US' },
      content: '&lt;p&gt;Hi&lt;/p&gt;',
      absolute_url: 'https://example.com/1',
      first_published: '2026-09-01T10:00:00Z',
    },
  });
  assert.equal(job.company, 'Acme');
  assert.equal(job.jobType, 'Remote');
  assert.equal(job.description, 'Hi');
  assert.equal(job.postedAt, '2026-09-01T10:00:00Z');
});

test('normalizeGreenhouseJob falls back for missing or invalid fields', () => {
  const job = normalizeGreenhouseJob({
    companyName: 'acme',
    job: { title: 'Software Engineer', first_published: 'garbage' },
  });
  assert.equal(job.company, 'acme');
  assert.equal(job.location, 'Unknown');
  assert.equal(job.applyUrl, '#');
  assert.equal(job.postedAt, '');
  assert.equal(job.jobType, 'On-site / Hybrid');
});

test('normalizeGreenhouseJob detects remote by whole word and treats hybrid as not remote', () => {
  const type = (name, title = 'Engineer') =>
    normalizeGreenhouseJob({ companyName: 'a', job: { title, location: { name } } }).jobType;
  assert.equal(type('Anywhere in the US'), 'Remote');
  assert.equal(type('Seattle, WA', 'Backend Engineer (Remote)'), 'Remote');
  assert.equal(type('Hybrid (Remote-friendly), NY'), 'On-site / Hybrid');
  assert.equal(type('Remoteville, TX'), 'On-site / Hybrid');
});

test('htmlToText decodes more named entities and leaves unknown ones', () => {
  assert.equal(htmlToText('caf&eacute; &deg; &frac12; &laquo;x&raquo;'), 'café ° ½ «x»');
  assert.equal(htmlToText('a &unknownthing; b'), 'a &unknownthing; b');
});
