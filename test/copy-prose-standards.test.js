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
  'log-message':
    'Log messages are one plain sentence, sentence case, ending in a period, with no colon or interpolation.',
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
  const tokens = wordsOf(text.replace(/\([^)]*\)/g, ' '));
  tokens.forEach((raw, i) => {
    if (raw.includes(DYN)) return;
    const word = bare(raw);
    if (!word || !/^[A-Za-z]/.test(word) || NOT_A_WORD.test(word)) return;
    if (raw.startsWith('.')) return; // a file extension (".zip"), not a word
    if (i > 0 && LOWER_OK.has(word.toLowerCase())) return;
    // A unit after a number ("1 hour", "30 days", "256 MB") is a measurement.
    if (i > 0 && /^\d[\d,.]*$/.test(tokens[i - 1])) return;
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
  // A placeholder that is an example (a host, a URL, "e.g. ...") is not prose.
  if (kind === 'placeholder' && (!/\s/.test(t) || /^e\.g\./i.test(t) || /^https?:/i.test(t))) return;
  const words = wordsOf(t.split(DYN).join(' ')).length;
  // Mostly-dynamic text ('${a} ${b} Java: ${c}') is a composed label, not a sentence.
  if (t.split(DYN).length > 2 && !/[.!?]/.test(t.replace(/[.!?…:]$/, ''))) return;
  // A trailing colon is a lead-in to a list or detail, not a broken sentence.
  // An ellipsis is legitimate anywhere text says something is still happening.
  const allowed = kind === 'summary' ? /[.!?]$/ : /[.!?…:]$/;
  // A placeholder or a screen-reader name is a short fragment, not a sentence.
  const fragment = kind === 'placeholder' || kind === 'name';
  if (!fragment && !endsDyn && !allowed.test(t) && (kind === 'summary' || words >= 3 || /[.!?]/.test(t))) {
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

/** `logger.info(...)`, `log.warn(...)`, `this.logger.error(...)`, or the bare `logger.warn` reference. */
function isLogger(callee) {
  if (callee.type !== 'MemberExpression') return false;
  const owner = callee.object.type === 'MemberExpression' ? callee.object.property : callee.object;
  return /^(?:logger|log)$/i.test(owner.name || '');
}

/** A log message: one plain sentence, sentence case, no colon, no interpolated variable. */
function logLine(file, line, col, text) {
  const t = text.trim();
  if (!t) return;
  const problems = [];
  if (t.includes(DYN)) problems.push('interpolates a variable (put it in the structured second argument)');
  if (!/[.!?]$/.test(t.replace(new RegExp(`${DYN}+$`), ''))) problems.push('does not end in . ! or ?');
  if (/^[a-z]/.test(t)) problems.push('does not start with a capital letter');
  if (t.replace(new RegExp(DYN, 'g'), '').includes(':')) problems.push('contains a colon');
  if (problems.length) {
    add(
      'log-message',
      file,
      line,
      col,
      t,
      problems.join('; '),
      'write one plain sentence and move variables to the second argument'
    );
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
const SENTENCE_KEYS = new Set([
  'help',
  'hint',
  'desc',
  'description',
  'tooltip',
  'message',
  'detail',
  'error',
  'excludes',
  'warning',
  'summary',
]);
// Properties holding an array of full sentences.
const SENTENCE_ARRAY_KEYS = new Set(['covers', 'tips', 'steps', 'bullets']);

const LABEL_KEYS = new Set([
  'label',
  'title',
  'heading',
  'placeholder',
  'subtitle',
  'action', // a verb phrase ("save that schedule") or a cleanup action label
  'note', // a badge ("Managed by the modpack installer UI"), not a sentence
  'ctaLabel',
  'confirmLabel',
  'cancelLabel',
  'buttonLabel',
]);
// Arrays whose `.push(text)` collects copy: whole sentences, or short fragments
// that are later joined into one.
const PUSH_TARGETS = {
  warnings: 'sentence',
  errors: 'sentence',
  problems: 'sentence',
  issues: 'sentence',
  lines: 'sentence',
  chips: 'fragment',
  bits: 'fragment',
  parts: 'fragment',
};

// Every string the scanner has judged, as `file:line:col`. The audit test at the
// bottom fails on any prose-looking string that is not in here, so a NEW place
// for copy to hide (a call, a property, an HTML string) cannot go unchecked.
const examined = new Set();
const posKey = (name, line, col) => `${name}:${line}:${col}`;
// How many strings only the fallback judged (see the end of scanJsSource), and
// the files whose long strings are not UI copy: prompts sent to a language model.
let fallbackCount = 0;
const FALLBACK_IGNORE = [/src[\\/]services[\\/]wizard(?:Powers)?\.js$/];

// SQL, log lines, regexes and thrown internals are not user copy.
const SQL_START = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA|WITH|BEGIN|COMMIT|REPLACE|VACUUM)\b/;
const INTERNAL_CALLS = new Set([
  'get',
  'all',
  'run',
  'exec',
  'prepare',
  'transaction',
  'require',
  'RegExp',
  'test',
  'match',
  'matchAll',
  'replace',
  'replaceAll',
  'split',
  'includes',
  'startsWith',
  'endsWith',
  'ok',
  'fail',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'trace',
  'log',
  'equal',
  'strictEqual',
  'deepEqual',
  'deepStrictEqual',
  'throws',
  'rejects',
  'assert',
  'captureError',
  'setHeader',
  'header',
  'getAttribute',
  'querySelector',
  'querySelectorAll',
  'closest',
  'matches',
  'addEventListener',
  'getElementById',
  'fetch',
  'sendFile',
  'render',
  'redirect',
  'sendStatus',
  'type',
  'on',
  'once',
  'emit',
  'spawn',
  'execFile',
  'execFileSync',
  'execSync',
  'write',
]);
const INTERNAL_NEW = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'RegExp',
  'Cron',
  'URL',
  'Map',
  'Set',
]);

/** The text itself when it reads like a sentence (DYN marks a dynamic part), else null. */
function proseText(text) {
  const t = text.trim();
  if (SQL_START.test(t) || /[<>{}\\]/.test(t)) return null;
  const words = wordsOf(t.split(DYN).join(' '));
  // Four or more words, opening with a capital, and containing a lowercase English word.
  if (words.length < 4 || !/^[A-Z]/.test(t) || !words.some((w) => /^[a-z]{2,}$/.test(bare(w)))) return null;
  return t;
}

/** True for a string that is code, a log line, or a thrown internal rather than copy. */
function isInternalContext(node, parent) {
  if (!parent) return false;
  if (parent.type === 'NewExpression') return INTERNAL_NEW.has(parent.callee.name);
  if (parent.type === 'ThrowStatement') return true;
  if (parent.type === 'CallExpression' && parent.callee !== node) {
    const name = parent.callee.type === 'Identifier' ? parent.callee.name : parent.callee.property?.name;
    return INTERNAL_CALLS.has(name);
  }
  if (parent.type === 'Property' && parent.value === node) {
    const key = propName(parent);
    return key === 'Content-Type' || key === 'User-Agent';
  }
  return false;
}

function scanJs(file, { catalog }) {
  scanJsSource(fs.readFileSync(file, 'utf8'), rel(file), { catalog, file });
}

/**
 * @param {string} source
 * @param {string} name  repo-relative path, for reports
 * @param {{ catalog?: boolean, file?: string, lineBase?: number, colBase?: number }} [opts]
 *   lineBase/colBase place a script embedded in a view at its real position.
 */
function scanJsSource(source, name, { catalog = false, file = name, lineBase = 0, colBase = 0 } = {}) {
  let ast;
  try {
    ast = parseJs(file, source);
  } catch (err) {
    add(
      'parse',
      name,
      (err.lineNumber || 1) + lineBase,
      err.column || 1,
      err.message,
      'could not be parsed, so it was not checked',
      'fix the syntax error'
    );
    return;
  }
  // Real file position of an espree location (embedded scripts are offset).
  const at = (loc) => [loc.line + lineBase, loc.line === 1 ? loc.column + 1 + colBase : loc.column + 1];

  const emit = (expr, fn) => {
    visit(expr, (n) => n.loc && examined.add(posKey(name, ...at(n.loc.start))));
    for (const r of readings(expr)) {
      const [line, col] = at(r.loc);
      universal(name, line, col, r.text, { catalog });
      if (fn) fn(r, line, col);
    }
  };
  const sentenceOf = (kind) => (r, line, col) =>
    sentence(name, line, col, r.text, { kind, startsDyn: r.startsDyn, endsDyn: r.endsDyn });
  const titleOf = (what) => (r, line, col) => checkTitleCase(name, line, col, r.text, what);
  const progressOf = (title) => (r, line, col) => progress(name, line, col, r.text, { title, endsDyn: r.endsDyn });
  const logMessage = (r, line, col) => logLine(name, line, col, r.text);

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
        // Log lines: `logger.info('Started a server.', { serverId })`, and the
        // failure throttle's `throttle.fail(logger.warn, 'A scan failed.', meta)`.
        case 'trace':
        case 'debug':
        case 'info':
        case 'warn':
        case 'error':
        case 'fatal':
          if (isLogger(node.callee)) emit(args[0], logMessage);
          break;
        case 'fail':
        case 'ok':
          if (args[0] && args[0].type === 'MemberExpression' && isLogger(args[0])) emit(args[1], logMessage);
          break;
        // Card and section headings built in JS.
        case 'section':
          emit(args[0], titleOf('heading'));
          break;
        case 'openProgress':
          emit(args[0], progressOf(true));
          break;
        // Messages a person reads: inline help, a 404 body, a socket error.
        case 'setHelp':
        case 'notFound':
        case 'onError':
          emit(args[0], sentenceOf('sentence'));
          break;
        // A message whispered to a player in game, and the RCON failure text.
        case 'whisper':
          emit(args[2], sentenceOf('sentence'));
          break;
        case 'assertRconOk':
          emit(args[1], sentenceOf('sentence'));
          break;
        // Validation messages: z.string().min(2, 'Choose a longer name.')
        case 'min':
        case 'max':
        case 'length':
        case 'regex':
        case 'refine':
        case 'superRefine':
        case 'gte':
        case 'lte':
        case 'gt':
        case 'lt':
        case 'int':
        case 'positive':
        case 'nonempty':
        case 'email':
        case 'url':
          if (node.callee.type === 'MemberExpression')
            for (const a of args.slice(1)) if (a.type !== 'ObjectExpression') emit(a, sentenceOf('sentence'));
          break;
        case 'copyToClipboard':
          emit(args[1], sentenceOf('toast'));
          break;
        // The inventory slot menu: `add('Change Count', 'hash', fn)` are menu items.
        case 'add':
          if (node.callee.type === 'Identifier' && args.length >= 3) emit(args[0], titleOf('menu item'));
          break;
        case 'push': {
          const target = node.callee.type === 'MemberExpression' ? node.callee.object.name : '';
          const kind = PUSH_TARGETS[target];
          if (kind === 'sentence') emit(args[0], sentenceOf('sentence'));
          else if (kind === 'fragment') emit(args[0], null);
          break;
        }
        default:
      }
    } else if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') {
      const p = node.left.property.name;
      if (['textContent', 'innerText', 'title', 'placeholder', 'ariaLabel', 'alt', 'tip'].includes(p)) {
        emit(node.right, p === 'title' || p === 'tip' ? sentenceOf('sentence') : null);
      }
    } else if (node.type === 'Property' && node.key && !node.computed) {
      const key = propName(node);
      if (node.value.type === 'ArrayExpression') {
        // A list of sentences ("covers: [...]"): judge each element.
        if (SENTENCE_ARRAY_KEYS.has(key)) for (const el of node.value.elements) emit(el, sentenceOf('sentence'));
        return;
      }
      if (node.value.type === 'ObjectExpression') return;
      if (SENTENCE_KEYS.has(key)) emit(node.value, sentenceOf('sentence'));
      else if (LABEL_KEYS.has(key)) emit(node.value, null);
    }
  });

  // HTML assembled in JS (innerHTML, insertAdjacentHTML, template strings,
  // "<b>" + x concatenation) is copy too. Each such string goes through the same
  // engine as the views, with every `${...}` standing in as a mustache.
  const HTML_LIKE =
    /<(?:a|b|i|u|p|br|hr|em|div|span|code|pre|small|strong|button|input|select|option|optgroup|label|legend|textarea|form|ul|ol|li|dl|dt|dd|table|thead|tbody|tr|td|th|caption|h[1-6]|details|summary|section|svg|img|figure|figcaption|blockquote)(?:\s|>|\/)/i;
  visit(ast, (node, parent) => {
    if (node.type !== 'Literal' && node.type !== 'TemplateLiteral' && node.type !== 'BinaryExpression') return;
    if (node.type === 'BinaryExpression' && node.operator !== '+') return;
    // The outermost `+` chain is read whole; its operands are not read again.
    if (parent && parent.type === 'BinaryExpression' && parent.operator === '+') return;
    for (const r of readings(node)) {
      if (!HTML_LIKE.test(r.text)) continue;
      visit(node, (n) => n.loc && examined.add(posKey(name, ...at(n.loc.start))));
      const [line, col] = at(r.loc);
      scanHtml(r.text.split(DYN).join('{{x}}'), name, { lineBase: line - 1, colBase: col - 1 });
    }
  });

  // Candidates for the fallback: every prose-looking string in the file. Any
  // that no context above examined is judged below, so a NEW property or call
  // name cannot hide copy from the universal rules.
  const local = [];
  visit(ast, (node, parent) => {
    const isPlus = node.type === 'BinaryExpression' && node.operator === '+';
    if (node.type !== 'Literal' && node.type !== 'TemplateLiteral' && !isPlus) return;
    // A "a " + "b" chain is one string: it is judged whole, not piece by piece.
    if (parent && parent.type === 'BinaryExpression' && parent.operator === '+') return;
    if (isInternalContext(node, parent)) return;
    for (const r of readings(node)) {
      const text = proseText(r.text);
      if (text === null) continue;
      const [line, col] = at(r.loc);
      local.push({ name, line, col, text });
    }
  });

  // Choices: `options: [{ label }]` are short selectable choices, so Title Case.
  visit(ast, (node) => {
    if (node.type === 'Property' && propName(node) === 'options' && node.value.type === 'ArrayExpression') {
      for (const el of node.value.elements) {
        const label = objProp(el, 'label');
        if (label) for (const r of readings(label.value)) checkTitleCase(name, ...at(r.loc), r.text, 'choice label');
      }
    }
  });

  if (catalog) {
    // A boolean field renders as a switch row, and a switch label is a choice,
    // so it is Title Case like every other toggle. (Other fields are captions.)
    visit(ast, (node) => {
      if (node.type !== 'ObjectExpression') return;
      const type = objProp(node, 'type');
      const label = objProp(node, 'label');
      if (!type || !label || type.value.type !== 'Literal' || type.value.value !== 'boolean') return;
      for (const r of readings(label.value)) checkTitleCase(name, ...at(r.loc), r.text, 'toggle label');
    });
    visit(ast, (node) => {
      if (node.type === 'Literal' && typeof node.value === 'string' && /[A-Za-z]'[A-Za-z]/.test(node.value)) {
        add(
          'catalog-curly',
          name,
          ...at(node.loc.start),
          node.value,
          'uses a straight apostrophe',
          'use the curly apostrophe ’ like the rest of the catalog'
        );
      }
    });
  }

  // Fallback for strings no context claimed. Without knowing whether one is a
  // label or a sentence, only the checks that are true of both apply, plus the
  // one thing that proves a string is a sentence: a full stop inside it.
  for (const c of local) {
    if (examined.has(posKey(c.name, c.line, c.col)) || FALLBACK_IGNORE.some((re) => re.test(c.name))) continue;
    fallbackCount += 1;
    universal(c.name, c.line, c.col, c.text, { catalog });
    if (/[.!?]\s+\S/.test(c.text) && !/[.!?…:]$/.test(c.text) && !c.text.endsWith(DYN)) {
      add(
        'sentence-punctuation',
        c.name,
        c.line,
        c.col,
        c.text,
        'does not end in . ! or ?',
        `add a terminal period: "${c.text}."`
      );
    }
  }
}

// -------------------------------------------------------------- view scanning

const lineColOf = (source, index) => {
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
  // A disabled option, or one that reads as a sentence or a progress line, is a
  // status message ("Loading biomes…"), not a choice.
  ['choice', /<option\b(?![^>]*\bdisabled\b)[^>]*>(?<t>[\s\S]*?)<\/option>/gi],
  ['menu item', /<summary\b[^>]*>(?<t>(?:(?!<span|<div)[\s\S])*?)<\/summary>/gi],
  ['button link', /<a\b[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>(?<t>[\s\S]*?)<\/a>/gi],
  ['tab', /<([a-z]+)\b[^>]*role="tab"[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  ['menu choice', /<([a-z]+)\b[^>]*role="(?:menuitem|option)"[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  // Only a chip you can press is a choice. A static chip is a badge, and a
  // quick-command chip is the literal console command it sends.
  [
    'toggle chip',
    /<(label|button)\b(?![^>]*\bdata-quick-cmd\b)[^>]*class="[^"]*\bchip\b[^"]*"[^>]*>(?<t>[\s\S]*?)<\/\1>/gi,
  ],
  // A checkbox or radio's own label is a selectable choice. The whole <label>
  // is read (input tag included), so a label that wraps a nested span is seen.
  [
    'checkbox label',
    /<label\b[^>]*>(?<t>(?:(?!<\/label>)[\s\S])*?<input\b[^>]*\btype=["'](?:checkbox|radio)["'](?:(?!<\/label>)[\s\S])*)<\/label>/gi,
    // The label is its first words; a description span after it is a sentence.
    (inner) =>
      inner.replace(
        /<(span|small|div|p)\b[^>]*class="[^"]*\b(?:text-xs|help|hint|block)\b[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
        ' '
      ),
  ],
  ['fieldset legend', /<legend\b[^>]*>(?<t>[\s\S]*?)<\/legend>/gi],
  ['table caption', /<caption\b[^>]*>(?<t>[\s\S]*?)<\/caption>/gi],
];
// Elements that hold a full sentence.
const SENTENCE_ELEMENTS = [
  ['paragraph', /<(p)\b[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  ['help text', /<(p|div|small)\b[^>]*class="[^"]*\b(?:help|hint)\b[^"]*"[^>]*>(?<t>[\s\S]*?)<\/\1>/gi],
  // Phrasing content only: an <li> that wraps blocks is a container, and its
  // children are judged on their own.
  [
    'list item',
    /<(li|figcaption|blockquote)\b[^>]*>(?<t>(?:(?!<(?:div|p|ul|ol|li|dl|table|section|h[1-6]|form|select)\b)[\s\S])*?)<\/\1>/gi,
  ],
];
// Attributes a person reads or hears. Title Case: a column label that mirrors
// a <th>, an <optgroup> name, a submit button's text. Sentence: tooltips,
// placeholders, screen-reader labels, alt text, descriptions.
const TITLE_ATTRS = ['data-th', 'optgroup label'];
const SENTENCE_ATTRS = [
  'title',
  'data-tip',
  'placeholder',
  'aria-label',
  'alt',
  'data-desc',
  'data-confirm',
  'content',
];
// Read for the universal rules only: a field name the page quotes back
// ("Task type" in the settings-change summary) is a caption, not a sentence.
const PLAIN_ATTRS = [
  'data-label',
  'data-title',
  'data-empty',
  'data-busy',
  'data-success',
  'data-error',
  'aria-description',
];

// Handlebars partial calls: `{{> page-header heading="X" sub='Y'}}`. Both quote
// styles carry copy, so every string param is read and routed by its name.
const PARTIAL_CALL = /\{\{#?>\s*[\w./-]+(?<args>(?:"[^"]*"|'[^']*'|[^}"'])*)\}\}/g;
const PARTIAL_ARG = /\b(?<key>[A-Za-z]\w*)=(?:"(?<dq>[^"]*)"|'(?<sq>[^']*)')/g;
const PARTIAL_TITLE_KEYS = new Set(['heading', 'title', 'label', 'ctaLabel', 'buttonLabel']);
const PARTIAL_SENTENCE_KEYS = new Set([
  'sub',
  'subtitle',
  'message',
  'help',
  'hint',
  'body',
  'description',
  'placeholder',
  'tooltip',
]);
// Helpers whose quoted arguments are shown to a person: `{{plural n 'crash' 'crashes'}}`.
const COPY_HELPER = /\{\{\{?\s*(?:default|plural)\b(?<args>[^}]*)\}\}\}?/g;

function scanView(file) {
  const source = fs.readFileSync(file, 'utf8');
  const name = rel(file);
  scanHtml(source, name);
  scanInlineScripts(source, name);
}

/**
 * Judge the copy in a piece of HTML/Handlebars: a whole view, or a fragment
 * that JS assembles (innerHTML, a template string). lineBase/colBase place a
 * fragment at its real position in the file it came from.
 */
function scanHtml(source, name, { lineBase = 0, colBase = 0 } = {}) {
  const lineCol = (src, index) => {
    const [line, col] = lineColOf(src, index);
    return [line + lineBase, line === 1 ? col + colBase : col];
  };
  // Scripts/styles/comments hold code, not copy (positions preserved).
  const view = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, blank)
    .replace(/<style\b[\s\S]*?<\/style>/gi, blank)
    .replace(/\{\{!--[\s\S]*?--\}\}/g, blank)
    .replace(/\{\{![\s\S]*?\}\}/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);

  // Runs fn(cleanText, line, col) for every match, once per {{#if}} branch.
  const each = (pattern, fn, pre = (x) => x) => {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(view))) {
      const inner = m.groups ? m.groups.t : m[1];
      const [line, col] = lineCol(view, m.index + m[0].indexOf(inner));
      for (const alt of branches(pre(inner))) fn(cleanHbs(alt), line, col);
    }
  };

  // Title Case: the elements above, and the title-ish params on partial calls.
  const tail = (text) => ({ endsDyn: text.endsWith(DYN), startsDyn: text.startsWith(DYN) });
  for (const [what, pattern, pre] of TITLE_ELEMENTS) {
    each(
      pattern,
      (text, line, col) => {
        if (!stripDyn(text)) return;
        if (what === 'choice' && /[.!?…]\s*$/.test(text)) return; // a status message
        // A long checkbox label is a sentence ("Install even if the build is not
        // listed as compatible"), not a short choice.
        if (what === 'checkbox label' && wordsOf(stripDyn(text)).length > 6) return;
        checkTitleCase(name, line, col, text, what);
      },
      pre
    );
  }
  for (const [what, pattern] of SENTENCE_ELEMENTS) {
    each(pattern, (text, line, col) => {
      if (stripDyn(text)) sentence(name, line, col, text, tail(text));
    });
    void what;
  }

  // Partial calls: both quote styles, routed by param name.
  PARTIAL_CALL.lastIndex = 0;
  let call;
  while ((call = PARTIAL_CALL.exec(view))) {
    const args = call.groups.args;
    const argsAt = call.index + call[0].length - 2 - args.length;
    PARTIAL_ARG.lastIndex = 0;
    let arg;
    while ((arg = PARTIAL_ARG.exec(args))) {
      const { key } = arg.groups;
      const value = arg.groups.dq ?? arg.groups.sq;
      const isTitle = PARTIAL_TITLE_KEYS.has(key);
      if (!isTitle && !PARTIAL_SENTENCE_KEYS.has(key)) continue;
      const [line, col] = lineCol(view, argsAt + arg.index + arg[0].indexOf('=') + 2);
      for (const alt of branches(value)) {
        const text = cleanHbs(alt);
        if (!stripDyn(text)) continue;
        universal(name, line, col, text);
        // A page-header heading is ALL CAPS by design.
        if (isTitle && text !== text.toUpperCase()) checkTitleCase(name, line, col, text, `partial ${key}`);
        else if (!isTitle) sentence(name, line, col, text, tail(text));
      }
    }
  }

  // Attributes, in either quote style. Partial calls are blanked first: their
  // `title='...'` is a partial param (judged above), not an HTML attribute.
  const attrView = view.replace(PARTIAL_CALL, blank);
  // A value may hold a mustache with its own quotes: data-desc="{{#if (eq t "x")}}…".
  const attrPattern = (attr) =>
    new RegExp(`\\b${attr}=(?:"(?<t>(?:\\{\\{[^}]*\\}\\}|[^"])*)"|'(?<s>(?:\\{\\{[^}]*\\}\\}|[^'])*)')`, 'gi');
  const eachAttr = (attr, fn) => {
    const re = attrPattern(attr);
    let am;
    while ((am = re.exec(attrView))) {
      const inner = am.groups.t ?? am.groups.s;
      const [line, col] = lineCol(attrView, am.index + am[0].indexOf(inner));
      for (const alt of branches(inner)) fn(cleanHbs(alt), line, col, am.index);
    }
  };
  // A monospace field takes literal input (a command, a path), so its placeholder
  // is an example of that input, not a sentence.
  const inMonoTag = (index) => /\bfont-mono\b/.test(attrView.slice(attrView.lastIndexOf('<', index), index));
  for (const attr of TITLE_ATTRS.filter((a) => !a.includes(' '))) {
    eachAttr(attr, (text, line, col) => {
      if (!stripDyn(text)) return;
      universal(name, line, col, text);
      checkTitleCase(name, line, col, text, `${attr} column label`);
    });
  }
  each(/<optgroup\b[^>]*\blabel="(?<t>[^"]*)"/gi, (text, line, col) => {
    if (!stripDyn(text)) return;
    universal(name, line, col, text);
    checkTitleCase(name, line, col, text, 'choice group');
  });
  each(/<input\b[^>]*\btype="(?:submit|button)"[^>]*\bvalue="(?<t>[^"]*)"/gi, (text, line, col) => {
    if (!stripDyn(text)) return;
    universal(name, line, col, text);
    checkTitleCase(name, line, col, text, 'button');
  });
  for (const attr of SENTENCE_ATTRS) {
    const kind =
      attr === 'placeholder'
        ? 'placeholder'
        : attr === 'aria-label' || attr === 'alt' || attr === 'data-desc'
          ? 'name'
          : 'sentence';
    eachAttr(attr, (text, line, col, index) => {
      if (!stripDyn(text)) return;
      universal(name, line, col, text);
      if (attr === 'placeholder' && inMonoTag(index)) return;
      // A <meta content> is only copy for a description; skip theme colors etc.
      if (attr === 'content' && !/\s/.test(text)) return;
      sentence(name, line, col, text, { ...tail(text), kind });
    });
  }
  for (const attr of PLAIN_ATTRS) {
    eachAttr(attr, (text, line, col) => {
      if (stripDyn(text)) universal(name, line, col, text);
    });
  }

  // Quoted arguments of copy-bearing helpers.
  COPY_HELPER.lastIndex = 0;
  let helper;
  while ((helper = COPY_HELPER.exec(view))) {
    const { args } = helper.groups;
    const argsAt = helper.index + helper[0].indexOf(args);
    const quoted = /'([^']*)'|"([^"]*)"/g;
    let q;
    while ((q = quoted.exec(args))) {
      const text = q[1] ?? q[2];
      const [line, col] = lineCol(view, argsAt + q.index + 1);
      if (stripDyn(text)) universal(name, line, col, text);
    }
  }

  // Universal rules on every text node.
  const textNodes = /(>|^)(?<t>[^<>]+)(?=<|$)/g;
  let m;
  while ((m = textNodes.exec(view))) {
    const [line, col] = lineCol(view, m.index + m[1].length);
    for (const alt of branches(m.groups.t)) {
      const text = cleanHbs(alt);
      if (stripDyn(text)) universal(name, line, col, text);
    }
  }
}

/**
 * Scripts inside a view hold copy too (toasts, labels). Mustaches are swapped
 * for `null` so the script parses, then it goes through the same JS scanner.
 * JSON data blocks and external `src` scripts have nothing to read.
 */
function scanInlineScripts(source, name) {
  const re = /<script\b(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(source))) {
    const { attrs, body } = m.groups;
    if (!body.trim() || /\bsrc=/.test(attrs) || /type="(?!module)[^"]*json[^"]*"/i.test(attrs)) continue;
    const code = body
      .replace(/\{\{!--[\s\S]*?--\}\}/g, blank)
      .replace(/\{\{![\s\S]*?\}\}/g, blank)
      .replace(/\{\{[#/^]?[^}]*\}\}\}?/g, (s) => 'null' + ' '.repeat(Math.max(0, s.length - 4)));
    const [line, col] = lineColOf(source, m.index + m[0].indexOf(body));
    scanJsSource(code, name, { file: `${name}.js`, lineBase: line - 1, colBase: col - 1 });
  }
}

// ------------------------------------------------------------ markdown scanning

const CONTRIBUTOR_DOCS = ['CONTRIBUTING.md', 'docs/architecture.md'];

/**
 * Old release notes are a record of what shipped, so only the newest section of
 * the changelog (the one being written, or the latest release) is held to the
 * style. Returns that section and how many lines precede it in the file.
 */
function newestChangelogSection(source) {
  const heads = [...source.matchAll(/^## \[/gm)].map((m) => m.index);
  if (!heads.length) return { text: source, lineBase: 0 };
  const end = heads[1] ?? source.length;
  return { text: source.slice(heads[0], end), lineBase: source.slice(0, heads[0]).split('\n').length - 1 };
}

function scanMarkdown(file) {
  const name = rel(file);
  const raw = fs.readFileSync(file, 'utf8');
  const { text: source, lineBase } = name === 'CHANGELOG.md' ? newestChangelogSection(raw) : { text: raw, lineBase: 0 };
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
    // Keep a Changelog's required heading format: "## [1.2.3] - 2026-01-01".
    if (/^##\s+\[[^\]]+\]\s+-\s+\d{4}-\d{2}-\d{2}\s*$/.test(text)) return;
    const t = text.trim();
    if (!t) return;
    const col = text.length - text.trimStart().length + 1;
    // Judge table cells one by one: a cell of only dashes or slashes is a placeholder.
    const cells = t.startsWith('|') ? t.split('|') : [t];
    for (const cell of cells) {
      if (!cell.trim() || /^[\s\-/:]*$/.test(cell)) continue;
      // Contributor docs name the banned words in order to ban them.
      universal(name, i + 1 + lineBase, col, cell.trim(), { jargon: !CONTRIBUTOR_DOCS.includes(name) });
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
    // CLAUDE.md addresses the coding assistant, not a reader of the product.
    .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md')
    .map((f) => path.join(ROOT, f)),
  ...listFiles(path.join(ROOT, 'docs'), ['.md']),
  ...listFiles(path.join(ROOT, '.github'), ['.md']),
];
for (const file of mdFiles) scanMarkdown(file);

// The other places a person reads text: the web app manifest (shown when the
// panel is installed), the package description, and the GitHub issue forms.
scanJsonStrings(path.join(ROOT, 'public', 'manifest.json'), ['name', 'short_name', 'description']);
scanJsonStrings(path.join(ROOT, 'package.json'), ['description']);
for (const file of listFiles(path.join(ROOT, '.github', 'ISSUE_TEMPLATE'), ['.yml', '.yaml'])) scanYamlText(file);

/** Universal rules on the named top-level string fields of a JSON file. */
function scanJsonStrings(file, keys) {
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(source);
  for (const key of keys) {
    if (typeof data[key] !== 'string') continue;
    const index = source.indexOf(JSON.stringify(data[key]));
    const [line, col] = lineColOf(source, Math.max(0, index));
    universal(rel(file), line, col, data[key]);
  }
}

/** Universal rules on the human text of a YAML issue form (labels, descriptions, placeholders). */
function scanYamlText(file) {
  const name = rel(file);
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((raw, i) => {
      const m = /^\s*(?:-\s+)?(?:label|description|placeholder|value|name|title|about):\s*(?<v>.+?)\s*$/.exec(raw);
      const body = m ? m.groups.v : /^\s{6,}(?<v>[^#\s-].*?)\s*$/.exec(raw)?.groups.v;
      if (!body) return;
      universal(name, i + 1, raw.indexOf(body) + 1, body.replace(/^["']|["']$/g, ''));
    });
}

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

// ------------------------------------------------------------ coverage check

test('strings no context claimed still reach the universal rules (the fallback)', () => {
  // If this is 0 the fallback is dead and a new property name could hide copy again.
  assert.ok(fallbackCount > 50, `fallback judged only ${fallbackCount} strings`);
});

test('every place the scanners claim to reach fires on a known-bad sample', () => {
  const before = found.length;
  const html = (source) => (n) => scanHtml(source, n);
  const js = (source) => (n) => scanJsSource(source, n, { file: `${n}.js` });
  // [what is being proven reachable, how to scan a bad sample of it, the rule it must trip]
  const SAMPLES = [
    ['checkbox label', html('<label><input type="checkbox"> shrink world afterwards</label>'), 'title-case'],
    ['radio label', html('<label><input type="radio" name="x"> only the ones i pick</label>'), 'title-case'],
    ['toggle chip', html('<button class="chip">some chip here</button>'), 'title-case'],
    ['legend', html('<legend>some group name</legend>'), 'title-case'],
    ['caption', html('<table><caption>some table name</caption></table>'), 'title-case'],
    ['data-th column label', html('<td data-th="next run">x</td>'), 'title-case'],
    ['optgroup label', html('<select><optgroup label="some group"></optgroup></select>'), 'title-case'],
    ['partial title, single quotes', html("{{> empty-state title='no things yet'}}"), 'title-case'],
    ['partial ctaLabel', html('{{> empty-state ctaLabel="add a thing"}}'), 'title-case'],
    ['partial sub', html('{{> page-header heading="X" sub="Tasks that run on a schedule"}}'), 'sentence-punctuation'],
    [
      'partial message, single quotes',
      html("{{> empty-state message='There is nothing here yet'}}"),
      'sentence-punctuation',
    ],
    ['list item', html('<ul><li>This item has no period</li></ul>'), 'sentence-punctuation'],
    ['single-quoted attribute', html("<div data-tip='no period at the end'>x</div>"), 'sentence-punctuation'],
    ['placeholder', html('<input placeholder="paste your key here">'), 'sentence-case'],
    ['aria-label', html('<button aria-label="open the menu">x</button>'), 'sentence-case'],
    ['helper string argument', html("{{default x 'Not set — yet'}}"), 'no-dash'],
    ['data-label', html('<select data-label="Pick — one"></select>'), 'no-dash'],
    [
      'mustache inside an attribute value',
      html('<div data-desc="{{#if (eq t "x")}}Snapshot — old{{/if}}">x</div>'),
      'no-dash',
    ],
    [
      'inline view script',
      (n) => scanInlineScripts("<script>toast('Something went wrong here')</script>", n),
      'sentence-punctuation',
    ],
    [
      'HTML in a JS string',
      js('el.innerHTML = \'<label><input type="checkbox"> shrink world</label>\';'),
      'title-case',
    ],
    ['HTML in a JS template', js('el.innerHTML = `<th>stone mined</th>`;'), 'title-case'],
    ['HTML in a JS concatenation', js("el.innerHTML = '<legend>some group' + x + '</legend>';"), 'title-case'],
    ['warnings.push', js("warnings.push('Something went wrong here');"), 'sentence-punctuation'],
    ['zod message', js("z.string().min(2, 'Too short a name here');"), 'sentence-punctuation'],
    ['whisper', js("whisper(id, player, 'wait a moment please');"), 'sentence-case'],
    ['section heading', js("section('ender chest', 'x');"), 'title-case'],
    ['logger line', js("logger.info('Started: a server');"), 'log-message'],
    ['throttled logger line', js("throttle.fail(logger.warn, 'A scan failed', {});"), 'log-message'],
    ['sentence list property', js("const x = { covers: ['See the server in the list'] };"), 'sentence-punctuation'],
    ['unclaimed property (fallback)', js("const x = { whatever: 'Hello there — friend of mine.' };"), 'no-dash'],
    [
      'unclaimed multi-sentence string (fallback)',
      js("const x = { whatever: 'First part here. Second part here' };"),
      'sentence-punctuation',
    ],
    [
      'markdown file',
      (n) => {
        const file = writeTmpMd(n, 'A sentence with a dash — in it.\n');
        try {
          scanMarkdown(file);
        } finally {
          fs.rmSync(file, { force: true });
        }
        return rel(file);
      },
      'no-dash',
    ],
  ];
  const missed = [];
  SAMPLES.forEach(([what, run, rule], i) => {
    const name = `sample-${i}.hbs`;
    const file = run(name) ?? name; // a sample that scans a real file reports that file's path
    if (!found.some((v) => v.file === file && v.rule === rule)) missed.push(`${what} (expected ${rule})`);
  });
  found.length = before; // the samples are not real findings
  assert.deepEqual(missed, [], `places the scan no longer reaches:\n  ${missed.join('\n  ')}`);
});

/** Writes a sample markdown file under the OS temp dir and returns its path. */
function writeTmpMd(name, body) {
  const file = path.join(require('node:os').tmpdir(), `prose-sample-${process.pid}-${name}.md`);
  fs.writeFileSync(file, body);
  return file;
}

test('only the newest changelog section is judged, and its line numbers stay true', () => {
  const log = '# Changelog\n\n## [2.0.0] - 2026-02-01\n\nNew thing.\n\n## [1.0.0] - 2026-01-01\n\nOld thing.\n';
  const { text, lineBase } = newestChangelogSection(log);
  assert.ok(text.includes('New thing.') && !text.includes('Old thing.'));
  assert.equal(lineBase, 2, 'the section starts on file line 3');
});
