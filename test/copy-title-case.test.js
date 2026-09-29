'use strict';

// House style (CONTRIBUTING.md #user-facing-copy): headings, table headers, and
// the short "label" text above a value (dt, eyebrow) are Title Case. This walks
// every view template and checks the STATIC text of those elements - dynamic
// {{mustache}} content and inline font-normal annotations (units, counts, "vs
// limit" style asides) are stripped first, since those are never part of the
// title itself. It only ever looks at plain-english alphabetic words; acronyms,
// numbers, and punctuation-led tokens are left alone.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const VIEWS_DIR = path.join(__dirname, '..', 'views');

function listHbsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listHbsFiles(full));
    else if (entry.name.endsWith('.hbs')) out.push(full);
  }
  return out;
}

// Elements whose text acts as a title/section-heading/field-label in this
// codebase's convention, and so must be Title Case. See overview.hbs.
const ELEMENT_PATTERNS = [
  /<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi,
  /<th\b[^>]*>([\s\S]*?)<\/th>/gi,
  /<dt\b[^>]*>([\s\S]*?)<\/dt>/gi,
  /<(?:div|span)\b[^>]*class="[^"]*\beyebrow\b[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)>/gi,
  // The bold label of a settings switch row (settings/toggle-row partial).
  /\{\{>\s*settings\/toggle-row\b[^}]*?\blabel="([^"]*)"/gi,
];

function cleanText(raw) {
  return (
    raw
      .replace(/\{\{!--[\s\S]*?--\}\}/g, ' ') // {{!-- comment --}}
      .replace(/\{\{![\s\S]*?\}\}/g, ' ') // {{! comment }}
      .replace(/\{\{\{[\s\S]*?\}\}\}/g, ' ') // {{{ triple-mustache (icon helper) }}}
      .replace(/\{\{[\s\S]*?\}\}/g, ' ') // {{ mustache expression }}
      // Inline annotations nested in a heading/label (units, live counts, "vs
      // limit" asides) are deliberately not Title Case - drop them entirely.
      .replace(/<span\b[^>]*class="[^"]*font-normal[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ')
      .replace(/<[^>]+>/g, ' ') // remaining tags: keep inner text
      .replace(/&amp;/g, '&')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// Minor words a real Title Case pass lowercases when they're not the first
// word (articles, coordinating conjunctions, short prepositions).
const LOWER_OK = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'off',
  'on',
  'onto',
  'or',
  'over',
  'per',
  'so',
  'than',
  'the',
  'to',
  'up',
  'via',
  'vs',
  'with',
  'yet',
]);

function titleCaseViolations(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const bad = [];
  words.forEach((raw, i) => {
    const word = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (!word) return;
    const first = word[0];
    if (!/[A-Za-z]/.test(first)) return; // digit/acronym-led token: nothing to check
    if (i > 0 && LOWER_OK.has(word.toLowerCase())) return;
    if (first !== first.toUpperCase()) bad.push(word);
  });
  return bad;
}

test('headings, table headers, and info labels in views/ are Title Case', () => {
  const violations = [];
  for (const file of listHbsFiles(VIEWS_DIR)) {
    const source = fs.readFileSync(file, 'utf8');
    const relFile = path.relative(path.join(__dirname, '..'), file);
    for (const pattern of ELEMENT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source))) {
        const text = cleanText(match[1]);
        if (!text) continue; // fully dynamic (e.g. {{server.name}} alone)
        const bad = titleCaseViolations(text);
        if (bad.length) violations.push(`${relFile}: "${text}" - not Title Case (${bad.join(', ')})`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Found ${violations.length} heading/label(s) not in Title Case:\n${violations.join('\n')}`
  );
});
