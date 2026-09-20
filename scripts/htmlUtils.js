// Escapes third-party job text before it goes into the email or dashboard HTML
import { FALLBACK_URL } from './jobDefaults.js';

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function safeUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? escapeHtml(url) : FALLBACK_URL;
  } catch {
    return FALLBACK_URL;
  }
}

// JSON for a <script> block: escapes "<" so job text can't close the tag.
// Separators are built from char codes; raw U+2028/2029 in source break the file.
const BACKSLASH = String.fromCharCode(92);
const LINE_SEPARATORS = new RegExp(
  '[' + String.fromCharCode(0x2028, 0x2029) + ']',
  'g',
);

export function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, BACKSLASH + 'u003c')
    .replace(
      LINE_SEPARATORS,
      (c) => BACKSLASH + 'u' + c.charCodeAt(0).toString(16),
    );
}
