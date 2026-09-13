'use strict';

// Regression coverage for issue #37: every JSON value a template embeds for the
// browser to JSON.parse must survive the trip. Two guards:
//
// 1. A static scan of every .hbs file. The helper name carries the context:
//    jsonScript belongs inside <script> text (the browser does NOT decode HTML
//    entities there) and jsonAttr inside an attribute value (a raw quote would
//    end it). Each helper returns a SafeString, so the brace count is
//    irrelevant; only the wrong helper in the wrong place can break a page, and
//    that is a build failure here rather than a dead page in production.
// 2. Real renders of the pages that embed JSON, with a server name made of
//    every awkward character, parsed the way the browser would.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const db = require('../src/db');

const VIEWS = path.join(__dirname, '..', 'views');
const NASTY_NAME = "Te\"st <&> 'x' </script> =`";

function hbsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? hbsFiles(p) : d.name.endsWith('.hbs') ? [p] : [];
  });
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x3D;/g, '=')
    .replace(/&#x60;/g, '`')
    .replace(/&amp;/g, '&');
}

// Split a template into <script> bodies and everything else, ignoring
// Handlebars comments. Case-insensitive; an unterminated <script> runs to EOF.
function scriptRegions(src) {
  const regions = [];
  const open = /<script\b[^>]*>/gi;
  let last = 0;
  let m;
  while ((m = open.exec(src))) {
    const bodyStart = m.index + m[0].length;
    const close = /<\/script\s*>/gi;
    close.lastIndex = bodyStart;
    const c = close.exec(src);
    const bodyEnd = c ? c.index : src.length;
    regions.push({ text: src.slice(last, m.index), offset: last, inScript: false });
    regions.push({ text: src.slice(bodyStart, bodyEnd), offset: bodyStart, inScript: true });
    last = c ? c.index + c[0].length : src.length;
    open.lastIndex = last;
  }
  regions.push({ text: src.slice(last), offset: last, inScript: false });
  return regions;
}

function stripComments(src) {
  // Keep the length stable so line numbers still point at the source.
  return src.replace(/\{\{!--[\s\S]*?--\}\}|\{\{![\s\S]*?\}\}/g, (c) => c.replace(/[^\n]/g, ' '));
}

function scanTemplate(src, rel) {
  const problems = [];
  const clean = stripComments(src);
  for (const { text, offset, inScript } of scriptRegions(clean)) {
    // The wrong helper for this context, with any brace count or whitespace.
    const re = inScript ? /\{\{\{?~?\s*jsonAttr\b/g : /\{\{\{?~?\s*jsonScript\b/g;
    let hit;
    while ((hit = re.exec(text))) {
      const line = clean.slice(0, offset + hit.index).split('\n').length;
      problems.push(
        inScript
          ? `${rel}:${line} uses jsonAttr inside <script>; use jsonScript (entities are not decoded there)`
          : `${rel}:${line} uses jsonScript outside <script>; use jsonAttr (a raw quote ends the attribute)`
      );
    }
    // The retired ambiguous helper, in either context.
    const old = /\{\{\{?~?\s*json\b/g;
    while ((hit = old.exec(text))) {
      const line = clean.slice(0, offset + hit.index).split('\n').length;
      problems.push(`${rel}:${line} uses the removed json helper; use jsonScript or jsonAttr`);
    }
  }
  return problems;
}

test('every template uses jsonScript inside <script> and jsonAttr everywhere else', () => {
  const problems = [];
  for (const file of hbsFiles(VIEWS)) {
    problems.push(...scanTemplate(fs.readFileSync(file, 'utf8'), path.relative(VIEWS, file)));
  }
  assert.deepEqual(problems, []);
});

test('the scan catches the wrong helper in either context, whatever the spelling', () => {
  const bad = [
    '<div data-x="{{jsonScript v}}"></div>',
    '<script type="application/json" id="a">{{jsonAttr v}}</script>',
    '<script type="application/json" id="a">{{{jsonAttr v}}}</script>',
    '<SCRIPT nonce="{{n}}">window.X = {{ jsonAttr v }};</SCRIPT >',
    '<script>\n  var x = {{~jsonAttr v}};\n</script>',
    '<script type="application/json">{{jsonAttr v}}', // unterminated: still script text
    '<script>{{json v}}</script>',
    '<div data-x="{{json v}}"></div>',
  ];
  for (const src of bad) assert.equal(scanTemplate(src, 't.hbs').length, 1, `should flag: ${src}`);

  const good = [
    '<div data-x="{{jsonAttr v}}" data-y=\'{{jsonAttr w}}\'></div>',
    '<script type="application/json" id="a">{{jsonScript v}}</script>',
    '<script type="application/json" id="a">{{{jsonScript v}}}</script>',
    '<SCRIPT nonce="{{n}}">window.X = Object.assign({}, {{jsonScript v}});</SCRIPT>',
    '<script>{{!-- {{jsonAttr v}} is wrong here --}}{{jsonScript v}}</script>',
    '<div data-x="{{jsonAttr v}}"></div>\n<script>{{jsonScript v}}</script>\n<div data-y="{{jsonAttr w}}"></div>',
    '{{! jsonScript in a comment }}<div data-x="{{jsonAttr v}}"></div>',
  ];
  for (const src of good) assert.deepEqual(scanTemplate(src, 't.hbs'), [], `should pass: ${src}`);

  // Line numbers point at the offending line.
  assert.match(scanTemplate('<div></div>\n<div></div>\n<div data-x="{{jsonScript v}}">', 't.hbs')[0], /^t\.hbs:3 /);
});

let cookie;
let serverId;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  serverId = app.seedServer('srv_json01');
  db.run(
    'UPDATE servers SET display_name = ?, tags_json = ?, env_json = ?, extra_ports_json = ?, extra_binds_json = ? WHERE id = ?',
    NASTY_NAME,
    JSON.stringify(['a"b', "c'd", '<e&f>']),
    JSON.stringify({ MOTD: 'Hi "there" <&> \'x\'', DIFFICULTY: 'normal' }),
    JSON.stringify([{ host: 25566, container: 25566, proto: 'tcp' }]),
    JSON.stringify([{ host: '/srv/"quoted" <dir>', container: '/data/x' }]),
    serverId
  );
});

test.after(async () => {
  await app.stop();
});

async function page(url) {
  const r = await app.req('GET', url, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200, `${url} returned ${r.status}`);
  return r.text;
}

// Every <script type="application/json"> island on the page must parse as-is.
function islands(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\btype="application\/json"/.test(m[1])) continue;
    const id = m[1].match(/\bid="([^"]+)"/);
    out.push({ id: id ? id[1] : '(no id)', body: m[2] });
  }
  return out;
}

// Every data-* attribute on the page whose (entity-decoded) value looks like
// JSON must parse. Values that are plain strings are skipped.
function jsonAttributes(html) {
  const out = [];
  for (const m of html.matchAll(/\s(data-[\w-]+)="([^"]*)"/g)) {
    const raw = decodeEntities(m[2]);
    if (/^\s*[[{]/.test(raw) || /^&quot;|^"/.test(m[2])) out.push({ name: m[1], raw });
  }
  return out;
}

function assertAllParse(url, html, expectIds, expectAttrs) {
  const found = islands(html);
  for (const id of expectIds)
    assert.ok(
      found.some((i) => i.id === id),
      `${url}: missing island #${id}`
    );
  for (const { id, body } of found) {
    assert.doesNotThrow(() => JSON.parse(body), `${url}: island #${id} is not valid JSON: ${body.slice(0, 80)}`);
  }
  const attrs = jsonAttributes(html);
  for (const a of expectAttrs)
    assert.ok(
      attrs.some((x) => x.name === a),
      `${url}: missing attribute ${a}`
    );
  for (const { name, raw } of attrs) {
    assert.doesNotThrow(() => JSON.parse(raw), `${url}: ${name} is not valid JSON: ${raw.slice(0, 80)}`);
  }
  return { islands: found, attrs };
}

test('settings page: user id and server picker islands parse (issue #37)', async () => {
  const html = await page('/settings');
  const { islands: found } = assertAllParse('/settings', html, ['settings-self', 'api-token-servers'], []);
  const self = JSON.parse(found.find((i) => i.id === 'settings-self').body);
  assert.match(self, /^usr_/);
  const servers = JSON.parse(found.find((i) => i.id === 'api-token-servers').body);
  assert.deepEqual(servers, [{ id: serverId, name: NASTY_NAME }]);
});

test('worlds and schedules pages: server pickers in data attributes parse', async () => {
  const worlds = await page('/worlds');
  const w = assertAllParse('/worlds', worlds, [], ['data-options']);
  assert.deepEqual(JSON.parse(w.attrs.find((a) => a.name === 'data-options').raw)[0].name, NASTY_NAME);

  const schedules = await page('/schedules');
  const s = assertAllParse('/schedules', schedules, [], ['data-servers', 'data-task-types']);
  assert.deepEqual(JSON.parse(s.attrs.find((a) => a.name === 'data-servers').raw)[0].name, NASTY_NAME);
});

test('server tabs: settings, worlds, players, commands and chat embeds parse', async () => {
  const base = `/servers/${serverId}`;
  const st = assertAllParse(
    `${base}/settings`,
    await page(`${base}/settings`),
    [],
    ['data-settings-tags', 'data-settings-docker-ports', 'data-settings-docker-binds', 'data-settings-env']
  );
  const attr = (n) => JSON.parse(st.attrs.find((a) => a.name === n).raw);
  assert.deepEqual(attr('data-settings-tags'), ['a"b', "c'd", '<e&f>']);
  assert.equal(attr('data-settings-env').MOTD, 'Hi "there" <&> \'x\'');
  assert.equal(attr('data-settings-docker-binds')[0].host, '/srv/"quoted" <dir>');
  assertAllParse(`${base}/worlds`, await page(`${base}/worlds`), [], ['data-options']);
  assertAllParse(`${base}/players`, await page(`${base}/players`), ['players-data'], []);
  assertAllParse(`${base}/commands`, await page(`${base}/commands`), ['chat-commands-data'], []);
  assertAllParse(`${base}/chat`, await page(`${base}/chat`), ['chat-history'], []);
});
