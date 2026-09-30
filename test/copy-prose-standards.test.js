'use strict';

// House style for everything a person reads (CONTRIBUTING.md #user-facing-copy),
// enforced mechanically. Every rule below is its own test, and a failing test
// lists EACH offending string as `file:line:col`, the rule, the exact text, and
// what to change it to.
//
// What is scanned
//   JS (src/, public/js/)   parsed with espree (real AST, so ternaries, template
//                           literals and "a" + b concatenation are all seen)
//   views/*.hbs             static text, attributes, headings, buttons, help
//   docs (*.md)             prose outside code blocks and `inline code`
//   field catalog           help/desc/labels, curly-apostrophe convention
// Dynamic parts (`${x}`, `{{x}}`, variables) are treated as opaque: a rule only
// judges the static text around them, and never the edge a dynamic part sits on.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const espree = require('espree');

const ROOT = path.join(__dirname, '..');
const DYN = '\u0001'; // stands in for any dynamic value inside a string

// ---------------------------------------------------------------- rule table

const RULES = {
  'title-case': 'Buttons, choices, headings, table headers, labels and modal titles are Title Case.',
  'sentence-punctuation': 'Sentence-shaped text (errors, toasts, summaries, help, tooltips) ends in . ! or ?',
  'sentence-case': 'Sentence-shaped text starts with a capital letter.',
  'summary-period': 'History summaries (recordEvent summary) always end in a period.',
  'progress-ellipsis': 'In-progress lines and progress titles end in an ellipsis, never a period.',
  'no-dash': 'No en dash, em dash, or spaced hyphen used as a sentence dash.',
  'quotes-straight': 'Straight quotes everywhere, except the field catalog which uses curly apostrophes.',
  'catalog-curly': 'The field catalog uses curly apostrophes consistently.',
  'no-jargon': 'No infrastructure jargon in user text.',
  'proper-noun': 'Proper nouns keep their capitalisation.',
  parse: 'Every scanned source file parses.',
};

/** @type {{rule:string,file:string,line:number,col:number,text:string,problem:string,fix:string}[]} */
const found = [];
const seen = new Set();
function add(rule, file, line, col, text, problem, fix) {
  const key = `${rule}|${file}|${line}|${col}|${problem}|${text}`;
  if (seen.has(key)) return;
  seen.add(key);
  const show = (t) => t.split(DYN).join('${…}');
  found.push({ rule, file, line, col, text: show(text), problem: show(problem), fix: show(fix) });
}

// ------------------------------------------------------------- text helpers

// Minor words a real Title Case pass lowercases when not the first word.
const LOWER_OK = new Set(
  'a an and as at but by for from in into nor of off on onto or over per so than the to up via vs with yet'.split(' ')
);
// Tokens that are identifiers/paths/ids/domains, not English words.
const NOT_A_WORD = /[._/:@#\\$=()[\]{}<>*+~^%&|`]|[a-z][A-Z]|\d/;

function wordsOf(text) {
  return text.split(/\s+/).filter(Boolean);
}
const bare = (raw) => raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');

/** Lowercase-initial English words that break Title Case. */
function titleCaseViolations(text) {
  const bad = [];
  // A parenthetical aside is an annotation, not part of the title.
  wordsOf(text.replace(/\([^)]*\)/g, ' ')).forEach((raw, i) => {
    if (raw.includes(DYN)) return;
    const word = bare(raw);
    if (!word || !/^[A-Za-z]/.test(word) || NOT_A_WORD.test(word)) return;
    if (i > 0 && LOWER_OK.has(word.toLowerCase())) return;
    if (word[0] !== word[0].toUpperCase()) bad.push(word);
  });
  return bad;
}

const titleCase = (text) =>
  wordsOf(text)
    .map((w, i) => (i > 0 && LOWER_OK.has(w.toLowerCase()) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');

const PROPER_NOUNS =
  'Minecraft Mojang Docker Java RCON Modrinth CurseForge BlueMap Discord Fabric Forge NeoForge Quilt Paper Purpur Bedrock Geyser'.split(
    ' '
  );
const PROPER_RE = new RegExp(
  `(^|[\\s("])(${PROPER_NOUNS.map((n) => n.toLowerCase()).join('|')}|nodejs|node\\.js)(?=$|[\\s)"'!?,;]|[.:](?:\\s|$))`,
  'g'
);
const JARGON = [
  [/\brecreat(?:e|es|ed|ing|ion)\b/i, '"recreate"', 'say "rebuild the server"'],
  [/\bOOM(?:-killed)?\b/, '"OOM"', 'say "stopped for running out of memory"'],
  [/(?:^|[\s("])\.\/data\b/, '"./data"', 'say "the data folder"'],
];

/** Rules that apply to ANY user-facing string. `catalog` relaxes the quote rule. */
function universal(file, line, col, text, { catalog = false, jargon = true } = {}) {
  if (/^[a-z][a-z0-9_-]*$/.test(text.trim())) return; // an id or step name, not prose
  let m;
  if ((m = /[–—]|&[mn]dash;/.exec(text)))
    add(
      'no-dash',
      file,
      line,
      col,
      text,
      `contains "${m[0]}"`,
      'split into two sentences, or use a colon or parentheses'
    );
  if ((m = / -{1,2} /.exec(text)))
    add(
      'no-dash',
      file,
      line,
      col,
      text,
      'uses a spaced hyphen as a dash',
      'split into two sentences, or use a colon or parentheses'
    );
  if (!catalog && (m = /[‘’“”]/.exec(text)))
    add('quotes-straight', file, line, col, text, `contains curly quote "${m[0]}"`, 'use a straight quote');
  for (const [re, what, fix] of jargon ? JARGON : []) {
    if (re.test(text)) add('no-jargon', file, line, col, text, `contains ${what}`, fix);
  }
  PROPER_RE.lastIndex = 0;
  while ((m = PROPER_RE.exec(text))) {
    const good =
      PROPER_NOUNS.find((n) => n.toLowerCase() === m[2]) ||
      (m[2] === 'nodejs' || m[2] === 'node.js' ? 'Node.js' : m[2]);
    add('proper-noun', file, line, col, text, `"${m[2]}" is lowercase`, `write "${good}"`);
  }
}

/** Sentence checks. `kind` picks which terminal punctuation is legal. */
function sentence(file, line, col, text, { kind = 'sentence', startsDyn = false, endsDyn = false } = {}) {
  const t = text.trim();
  if (!t) return;
  const words = wordsOf(t.split(DYN).join(' ')).length;
  // Mostly-dynamic text ('${a} ${b} Java: ${c}') is a composed label, not a sentence.
  if (t.split(DYN).length > 2 && !/[.!?]/.test(t.replace(/[.!?…:]$/, ''))) return;
  // A trailing colon is a lead-in to a list or detail, not a broken sentence.
  // An ellipsis is legitimate anywhere text says something is still happening.
  const allowed = kind === 'summary' ? /[.!?]$/ : /[.!?…:]$/;
  if (!endsDyn && !allowed.test(t) && (kind === 'summary' || words >= 3 || /[.!?]/.test(t))) {
    const rule = kind === 'summary' ? 'summary-period' : 'sentence-punctuation';
    add(rule, file, line, col, t, 'does not end in . ! or ?', `add a terminal period: "${t}."`);
  }
  const first = wordsOf(t)[0] || '';
  if (
    !startsDyn &&
    first &&
    !first.includes(DYN) &&
    /^[a-z]/.test(first) &&
    !NOT_A_WORD.test(bare(first)) &&
    words >= 3
  ) {
    add(
      'sentence-case',
      file,
      line,
      col,
      t,
      'does not start with a capital letter',
      `capitalise: "${first[0].toUpperCase() + first.slice(1)}…"`
    );
  }
}

/** In-progress lines: an ongoing action ends in an ellipsis, an outcome in a period. */
function progress(file, line, col, text, { title = false, endsDyn = false } = {}) {
  const t = text.trim();
  // A lowercase single word is a step id (e.g. 'applying'), not text a person reads.
  if (!t || (endsDyn && !title) || t.endsWith('…') || /^[a-z][a-z0-9_-]*$/.test(t)) return;
  const gerund = /^[A-Z][a-z]+ing\b/.test(t);
  if (title || gerund) {
    const shown = t.replace(/[.!?:]+$/, '').replace(/\.{3}$/, '');
    add('progress-ellipsis', file, line, col, t, 'in-progress text must end in an ellipsis', `use "${shown}…"`);
  } else if (!/[.!?]$/.test(t)) {
    add('sentence-punctuation', file, line, col, t, 'an outcome line must end in . ! or ?', `add a period: "${t}."`);
  }
}

function checkTitleCase(file, line, col, text, what) {
  const bad = titleCaseViolations(text);
  if (bad.length) {
    add(
      'title-case',
      file,
      line,
      col,
      text,
      `${what}: lowercase word(s) ${bad.map((w) => `"${w}"`).join(', ')}`,
      `use "${titleCase(text)}"`
    );
  }
}

// ---------------------------------------------------------------- JS scanning

function listFiles(dir, exts, skipDirs = ['node_modules', 'dist', 'vendor', '.git', 'coverage']) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.includes(entry.name)) out.push(...listFiles(full, exts, skipDirs));
    } else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}
const rel = (f) => path.relative(ROOT, f);

function parseJs(file, source) {
  const base = { ecmaVersion: 'latest', loc: true, allowHashBang: true };
  const order = file.includes(`${path.sep}public${path.sep}`) ? ['module', 'script'] : ['script', 'module'];
  let lastErr;
  for (const sourceType of order) {
    try {
      return espree.parse(source, { ...base, sourceType });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function visit(node, fn, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const v = node[key];
    if (Array.isArray(v)) for (const c of v) visit(c, fn, node);
    else if (v && typeof v.type === 'string') visit(v, fn, node);
  }
}

/** Every static-text reading of an expression: [{ text, loc, startsDyn, endsDyn }]. */
function readings(node) {
  const alts = alternatives(node);
  return alts
    .map(({ parts, loc }) => {
      const text = parts.map((p) => (p === null ? DYN : p)).join('');
      return { text, loc, startsDyn: parts[0] === null, endsDyn: parts[parts.length - 1] === null };
    })
    .filter((r) => r.loc && r.text.replace(new RegExp(DYN, 'g'), '').trim());
}
function alternatives(n) {
  if (!n) return [{ parts: [null], loc: null }];
  switch (n.type) {
    case 'Literal':
      return typeof n.value === 'string' ? [{ parts: [n.value], loc: n.loc.start }] : [{ parts: [null], loc: null }];
    case 'TemplateLiteral': {
      const parts = [];
      n.quasis.forEach((q, i) => {
        if (q.value.cooked) parts.push(q.value.cooked);
        if (i < n.expressions.length) parts.push(null);
      });
      return [{ parts, loc: n.loc.start }];
    }
    case 'BinaryExpression':
      if (n.operator !== '+') return [{ parts: [null], loc: null }];
      return alternatives(n.left).flatMap((l) =>
        alternatives(n.right).map((r) => ({ parts: [...l.parts, ...r.parts], loc: l.loc || r.loc }))
      );
    case 'ConditionalExpression':
      return [...alternatives(n.consequent), ...alternatives(n.alternate)];
    case 'LogicalExpression':
      return [...alternatives(n.left), ...alternatives(n.right)];
    default:
      return [{ parts: [null], loc: null }];
  }
}

const propName = (p) => (p.key && (p.key.name || p.key.value)) || null;
const calleeName = (c) => (c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property.name : null);
const objProp = (obj, name) =>
  obj && obj.type === 'ObjectExpression'
    ? obj.properties.find((p) => p.type === 'Property' && propName(p) === name)
    : null;

// Property keys whose string value is a full sentence / a short label.
const SENTENCE_KEYS = new Set(['help', 'hint', 'desc', 'description', 'tooltip', 'message', 'detail', 'error']);
const LABEL_KEYS = new Set(['label', 'title', 'heading', 'placeholder', 'subtitle', 'summary']);

function scanJs(file, { catalog }) {
  const source = fs.readFileSync(file, 'utf8');
  const name = rel(file);
  let ast;
  try {
    ast = parseJs(file, source);
  } catch (err) {
    add(
      'parse',
      name,
      err.lineNumber || 1,
      err.column || 1,
      err.message,
      'could not be parsed, so it was not checked',
      'fix the syntax error'
    );
    return;
  }

  const emit = (expr, fn) => {
    for (const r of readings(expr)) {
      universal(name, r.loc.line, r.loc.column + 1, r.text, { catalog });
      if (fn) fn(r, r.loc.line, r.loc.column + 1);
    }
  };
  const sentenceOf = (kind) => (r, line, col) =>
    sentence(name, line, col, r.text, { kind, startsDyn: r.startsDyn, endsDyn: r.endsDyn });
  const titleOf = (what) => (r, line, col) => checkTitleCase(name, line, col, r.text, what);
  const progressOf = (title) => (r, line, col) => progress(name, line, col, r.text, { title, endsDyn: r.endsDyn });

  visit(ast, (node) => {
    if (node.type === 'CallExpression') {
      const fnName = calleeName(node.callee);
      const args = node.arguments;
      const opts = args.find((a) => a.type === 'ObjectExpression') || null;
      switch (fnName) {
        case 'httpError':
          emit(args[1], sentenceOf('sentence'));
          break;
        case 'toast':
          emit(args[0], sentenceOf('toast'));
          break;
        case 'step':
        case 'onProgress':
        case 'onStep':
          emit(args[0], progressOf(false));
          break;
        case 'run':
        case 'track':
          if (node.callee.type === 'MemberExpression' && node.callee.object.name === 'tasks')
            emit(args[0], progressOf(true));
          break;
        case 'runTask':
          if (objProp(opts, 'title')) emit(objProp(opts, 'title').value, progressOf(true));
          break;
        case 'recordEvent':
          if (objProp(opts, 'summary')) emit(objProp(opts, 'summary').value, sentenceOf('summary'));
          break;
        case 'confirmDialog':
          if (objProp(opts, 'title')) emit(objProp(opts, 'title').value, sentenceOf('sentence'));
          if (objProp(opts, 'message')) emit(objProp(opts, 'message').value, sentenceOf('sentence'));
          for (const k of ['confirmLabel', 'cancelLabel'])
            if (objProp(opts, k)) emit(objProp(opts, k).value, titleOf('button'));
          break;
        case 'openModal': {
          const title = objProp(opts, 'title');
          if (title)
            emit(title.value, (r, line, col) => {
              if (r.text.trim().endsWith('…')) return;
              checkTitleCase(name, line, col, r.text, 'modal title');
            });
          const actions = objProp(opts, 'actions');
          if (actions && actions.value.type === 'ArrayExpression') {
            for (const a of actions.value.elements) {
              const label = objProp(a, 'label');
              if (label) emit(label.value, titleOf('button'));
              const busy = objProp(a, 'busyLabel');
              if (busy) emit(busy.value, progressOf(true));
            }
          }
          break;
        }
        case 'setAttribute': {
          const attr = args[0] && args[0].type === 'Literal' ? args[0].value : '';
          if (['title', 'data-tip', 'placeholder', 'aria-label', 'alt'].includes(attr))
            emit(args[1], attr === 'title' || attr === 'data-tip' ? sentenceOf('sentence') : null);
          break;
        }
        default:
      }
    } else if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') {
      const p = node.left.property.name;
      if (['textContent', 'title', 'placeholder', 'ariaLabel', 'alt'].includes(p)) {
        emit(node.right, p === 'title' ? sentenceOf('sentence') : null);
      }
    } else if (node.type === 'Property' && node.key && !node.computed) {
      const key = propName(node);
      if (node.value.type === 'ObjectExpression' || node.value.type === 'ArrayExpression') return;
      if (SENTENCE_KEYS.has(key)) emit(node.value, sentenceOf('sentence'));
      else if (LABEL_KEYS.has(key) && key !== 'summary') emit(node.value, null);
    }
  });

  // Choices: `options: [{ label }]` are short selectable choices, so Title Case.
  visit(ast, (node) => {
    if (node.type === 'Property' && propName(node) === 'options' && node.value.type === 'ArrayExpression') {
      for (const el of node.value.elements) {
        const label = objProp(el, 'label');
        if (label)
          for (const r of readings(label.value))
            checkTitleCase(name, r.loc.line, r.loc.column + 1, r.text, 'choice label');
      }
    }
  });

  if (catalog) {
    visit(ast, (node) => {
      if (node.type === 'Literal' && typeof node.value === 'string' && /[A-Za-z]'[A-Za-z]/.test(node.value)) {
        add(
          'catalog-curly',
          name,
          node.loc.start.line,
          node.loc.start.column + 1,
          node.value,
          'uses a straight apostrophe',
          'use the curly apostrophe ’ like the rest of the catalog'
        );
      }
    });
  }
}

// -------------------------------------------------------------- view scanning

const lineCol = (source, index) => {
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  return [line, index - before.lastIndexOf('\n')];
};
const blank = (s) => s.replace(/[^\n]/g, ' ');

/** Mustache -> DYN, tags -> space, entities decoded. */
function cleanHbs(raw) {
  return raw
    .replace(/\{\{!--[\s\S]*?--\}\}/g, ' ')
    .replace(/\{\{![\s\S]*?\}\}/g, ' ')
    .replace(/\{\{\{[\s\S]*?\}\}\}/g, ' ')
    .replace(/\{\{[#/^]?(?:if|else|unless|each|with)\b[\s\S]*?\}\}|\{\{else\}\}|\{\{\/[a-z]+\}\}/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, DYN)
    .replace(/<span\b[^>]*class="[^"]*font-normal[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const stripDyn = (t) => t.split(DYN).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Expand `{{#if}}A{{else}}B{{/if}}` into one string per branch, so each branch
 * is judged as its own piece of copy instead of "A B" glued together.
 */
function branches(raw) {
  const block =
    /\{\{#(?:if|unless)\b[^}]*\}\}((?:(?!\{\{#(?:if|unless)\b)[\s\S])*?)(?:\{\{else\}\}((?:(?!\{\{#(?:if|unless)\b)[\s\S])*?))?\{\{\/(?:if|unless)\}\}/;
  let out = [raw];
  for (let guard = 0; guard < 6; guard++) {
    const next = [];
    let changed = false;
    for (const str of out) {
      const m = block.exec(str);
      if (!m || next.length > 32) {
        next.push(str);
        continue;
      }
      changed = true;
      const [whole, yes, no = ''] = m;
      next.push(str.replace(whole, yes), str.replace(whole, no));
    }
    out = next;
    if (!changed) break;
  }
  return [...new Set(out)];
}

// Elements whose static text must be Title Case. Group `t` is the inner text;
// `\1` closes the same tag so nested spans don't end the match early.
const TITLE_ELEMENTS = [
  ['heading', /<h[1-4]\b[^>]*>(?<t>[\s\S]*?)<\/h[1-4]>/gi],
  ['table header', /<th\b[^>]*>(?<t>[\s\S]*?)<\/th>/gi],
  ['label', /<dt\b[^>]*>(?<t>[\s\S]*?)<\/dt>/gi],
  ['eyebrow', /<(div|span)\b[^>]*class="[^"]*\beyebrow\b[^"]*"[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  ['button', /<button\b(?![^>]*\bdata-quick-cmd\b)[^>]*>(?<t>[\s\S]*?)<\/button>/gi],
  ['choice', /<option\b[^>]*>(?<t>[\s\S]*?)<\/option>/gi],
  ['menu item', /<summary\b[^>]*>(?<t>(?:(?!<span|<div)[\s\S])*?)<\/summary>/gi],
  ['button link', /<a\b[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>(?<t>[\s\S]*?)<\/a>/gi],
  ['tab', /<([a-z]+)\b[^>]*role="tab"[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  ['partial heading/label', /\{\{[#]?>\s*[\w./-]+\b[^}]*?\b(?:heading|label|title)="(?<t>[^"]*)"/g],
];
// Elements/args that hold a full sentence.
const SENTENCE_ELEMENTS = [
  ['paragraph', /<(p)\b[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  ['help text', /<(p|div|small)\b[^>]*class="[^"]*\b(?:help|hint)\b[^"]*"[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  ['partial message', /\{\{[#]?>\s*[\w./-]+\b[^}]*?\b(?:message|help|hint|body)="(?<t>[^"]*)"/g],
];
const ATTRS = ['title', 'data-tip', 'placeholder', 'aria-label', 'alt'];

function scanView(file) {
  const source = fs.readFileSync(file, 'utf8');
  const name = rel(file);
  // Scripts/styles/comments hold code, not copy (positions preserved).
  const view = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, blank)
    .replace(/<style\b[\s\S]*?<\/style>/gi, blank)
    .replace(/\{\{!--[\s\S]*?--\}\}/g, blank)
    .replace(/\{\{![\s\S]*?\}\}/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);

  // Runs fn(cleanText, line, col) for every match, once per {{#if}} branch.
  const each = (pattern, fn) => {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(view))) {
      const inner = m.groups ? m.groups.t : m[1];
      const [line, col] = lineCol(view, m.index + m[0].indexOf(inner));
      for (const alt of branches(inner)) fn(cleanHbs(alt), line, col);
    }
  };

  for (const [what, pattern] of TITLE_ELEMENTS) {
    each(pattern, (text, line, col) => {
      if (!stripDyn(text)) return;
      // A partial's page-header heading is ALL CAPS by design.
      if (what === 'partial heading/label' && text === text.toUpperCase()) return;
      checkTitleCase(name, line, col, text, what);
    });
  }
  const tail = (text) => ({ endsDyn: text.endsWith(DYN), startsDyn: text.startsWith(DYN) });
  for (const [, pattern] of SENTENCE_ELEMENTS) {
    each(pattern, (text, line, col) => {
      if (stripDyn(text)) sentence(name, line, col, text, tail(text));
    });
  }
  for (const attr of ['title', 'data-tip']) {
    each(new RegExp(`\\b${attr}="(?<t>[^"]*)"`, 'gi'), (text, line, col) => {
      if (stripDyn(text)) sentence(name, line, col, text, tail(text));
    });
  }

  // Universal rules on every text node and on every copy-bearing attribute.
  const textNodes = /(>|^)(?<t>[^<>]+)(?=<|$)/g;
  let m;
  while ((m = textNodes.exec(view))) {
    const [line, col] = lineCol(view, m.index + m[1].length);
    for (const alt of branches(m.groups.t)) {
      const text = cleanHbs(alt);
      if (stripDyn(text)) universal(name, line, col, text);
    }
  }
  for (const attr of [...ATTRS, 'heading', 'label', 'message', 'help', 'hint', 'body']) {
    each(new RegExp(`\\b${attr}="(?<t>[^"]*)"`, 'g'), (text, line, col) => {
      if (stripDyn(text)) universal(name, line, col, text);
    });
  }
}

// ------------------------------------------------------------ markdown scanning

const CONTRIBUTOR_DOCS = ['CONTRIBUTING.md', 'docs/architecture.md'];

function scanMarkdown(file) {
  const name = rel(file);
  const source = fs.readFileSync(file, 'utf8');
  const prose = source
    .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, blank) // fenced code
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/`[^`\n]*`/g, blank) // inline code
    .replace(/\]\([^)\n]*\)/g, (s) => blank(s)) // link targets
    .replace(/https?:\/\/\S+/g, blank)
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, blank) // table separator rows
    .replace(/\|\s*-\s*(?=\|)/g, (s) => blank(s)); // "-" as an empty table cell
  prose.split('\n').forEach((text, i) => {
    if (/^\s*[-*_]{3,}\s*$/.test(text)) return; // horizontal rule
    const t = text.trim();
    if (!t) return;
    const col = text.length - text.trimStart().length + 1;
    // Judge table cells one by one: a cell of only dashes or slashes is a placeholder.
    const cells = t.startsWith('|') ? t.split('|') : [t];
    for (const cell of cells) {
      if (!cell.trim() || /^[\s\-/:]*$/.test(cell)) continue;
      // Contributor docs name the banned words in order to ban them.
      universal(name, i + 1, col, cell.trim(), { jargon: !CONTRIBUTOR_DOCS.includes(name) });
    }
  });
}

// ------------------------------------------------------------------- the run

const CATALOG_DIR = path.join(ROOT, 'src', 'config', 'field-catalog');
for (const file of [
  ...listFiles(path.join(ROOT, 'src'), ['.js']),
  ...listFiles(path.join(ROOT, 'public', 'js'), ['.js']),
]) {
  scanJs(file, { catalog: file.startsWith(CATALOG_DIR) });
}
for (const file of listFiles(path.join(ROOT, 'views'), ['.hbs'])) scanView(file);
const mdFiles = [
  ...fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md' && f !== 'CHANGELOG.md')
    .map((f) => path.join(ROOT, f)),
  ...listFiles(path.join(ROOT, 'docs'), ['.md']),
];
for (const file of mdFiles) scanMarkdown(file);

function report(rule) {
  const hits = found
    .filter((v) => v.rule === rule)
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  const lines = hits.map(
    (v) => `  ${v.file}:${v.line}:${v.col}\n    text:    "${v.text}"\n    problem: ${v.problem}\n    fix:     ${v.fix}`
  );
  return `${hits.length} violation(s) of "${rule}": ${RULES[rule]}\n\n${lines.join('\n\n')}\n`;
}

for (const rule of Object.keys(RULES)) {
  test(`[${rule}] ${RULES[rule]}`, () => {
    if (found.some((v) => v.rule === rule)) assert.fail(`\n${report(rule)}`);
  });
}

test('the scan actually reaches every kind of text it claims to check', () => {
  // Guards against a refactor silently turning the rules above into no-ops.
  const files = { js: 0, hbs: 0, md: mdFiles.length };
  files.js =
    listFiles(path.join(ROOT, 'src'), ['.js']).length + listFiles(path.join(ROOT, 'public', 'js'), ['.js']).length;
  files.hbs = listFiles(path.join(ROOT, 'views'), ['.hbs']).length;
  assert.ok(files.js > 50 && files.hbs > 10 && files.md > 5, JSON.stringify(files));
  assert.ok(readings({ type: 'Literal', value: 'x y', loc: { start: { line: 1, column: 0 } } }).length === 1);
});

test('every rule can actually fire (a passing rule is not a dead rule)', () => {
  const before = found.length;
  const SAMPLES = {
    'title-case': () => checkTitleCase('x', 1, 1, 'save changes', 'button'),
    'sentence-punctuation': () => sentence('x', 1, 1, 'Server not found'),
    'sentence-case': () => sentence('x', 1, 1, 'server was not found.'),
    'summary-period': () => sentence('x', 1, 1, 'Server restarted', { kind: 'summary' }),
    'progress-ellipsis': () => progress('x', 1, 1, 'Creating backup.', { title: true }),
    'no-dash': () => universal('x', 1, 1, 'Wait \u2014 then retry'),
    'quotes-straight': () => universal('x', 1, 1, 'It\u2019s done'),
    'no-jargon': () => universal('x', 1, 1, 'Server was recreated'),
    'proper-noun': () => universal('x', 1, 1, 'Install the minecraft server'),
  };
  const missed = [];
  for (const [rule, run] of Object.entries(SAMPLES)) {
    const n = found.length;
    run();
    if (!found.slice(n).some((v) => v.rule === rule)) missed.push(rule);
  }
  found.length = before; // the samples are not real findings
  assert.deepEqual(missed, [], `rules that never fired on a known-bad sample: ${missed.join(', ')}`);
});

// PROSE_JSON=out.json pnpm run test:prose dumps every finding for scripted fixes.
if (process.env.PROSE_JSON) fs.writeFileSync(process.env.PROSE_JSON, JSON.stringify(found, null, 1));
