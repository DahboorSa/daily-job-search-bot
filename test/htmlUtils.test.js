import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeUrl, jsonForScript } from '../scripts/htmlUtils.js';

test('escapeHtml escapes markup characters and tolerates null', () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(42), '42');
});

test('safeUrl allows http(s) and rejects other schemes', () => {
  assert.equal(safeUrl('https://example.com/a?b=1&c=2'), 'https://example.com/a?b=1&amp;c=2');
  assert.equal(safeUrl('http://example.com'), 'http://example.com');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('not a url'), '#');
  assert.equal(safeUrl(undefined), '#');
});

test('jsonForScript cannot close a script tag and round-trips', () => {
  const value = { t: '</script><b>', sep: 'a b c' };
  const out = jsonForScript(value);
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes(' ') && !out.includes(' '));
  assert.deepEqual(JSON.parse(out), value);
});
