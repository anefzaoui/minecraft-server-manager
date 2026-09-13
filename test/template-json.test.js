'use strict';

// Regression coverage for issue #37: every JSON value a template embeds for the
// browser to JSON.parse must survive the trip. Two guards:
//
// 1. A static scan of every .hbs file. Inside <script> text the browser does
//    NOT decode HTML entities, so the `json` helper must be rendered raw
//    ({{{json x}}}); inside an attribute it must be escaped ({{json x}}) or a
//    quote ends the attribute. The wrong pairing is a build failure here, not
//    a dead page in production.
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

test('templates pair the json helper with the right brace count for its context', () => {
  const problems = [];
  for (const file of hbsFiles(VIEWS)) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(VIEWS, file);
    // Split the template into <script>…</script> bodies and everything else.
    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
    let last = 0;
    let m;
    const check = (chunk, inScript, offset) => {
      const re = inScript ? /(?<!\{)\{\{json\b/g : /\{\{\{json\b/g;
      let hit;
      while ((hit = re.exec(chunk))) {
        const line = src.slice(0, offset + hit.index).split('\n').length;
        problems.push(
          inScript
            ? `${rel}:${line} uses {{json}} inside <script>; use {{{json}}} (entities are not decoded there)`
            : `${rel}:${line} uses {{{json}}} outside <script>; use {{json}} (a raw quote ends the attribute)`
        );
      }
    };
    while ((m = scriptRe.exec(src))) {
      check(src.slice(last, m.index), false, last);
      const bodyStart = m.index + m[0].indexOf(m[1]);
      check(m[1], true, bodyStart);
      last = m.index + m[0].length;
    }
    check(src.slice(last), false, last);
  }
  assert.deepEqual(problems, []);
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
  return [...html.matchAll(/<script type="application\/json" id="([^"]+)">([\s\S]*?)<\/script>/g)].map((m) => ({
    id: m[1],
    body: m[2],
  }));
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
