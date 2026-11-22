'use strict';

// Issue #113: saving a server's settings changed settings nobody touched (the
// resource sliders, the world border), and emptying a field to go back to the
// default left its last value in server.properties. A save goes through the
// page the way the browser runs it: the settings tab as rendered, one field
// changed, the save body built by the page's own module
// (public/js/lib/settingsChanges.js), then the PATCH. Everything else must
// come out byte for byte as it went in.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

const ID = 'srv_untch01';
const ENV = {
  MOTD: 'A Fabric server',
  VIEW_DISTANCE: '20',
  SIMULATION_DISTANCE: '10',
  MAX_WORLD_SIZE: '20',
  ALLOW_FLIGHT: 'true',
  MAX_PLAYERS: '12',
};
// The file as the image and Minecraft leave it.
const PROPERTIES = [
  '#Minecraft server properties',
  '#Sat Nov 21 12:00:00 UTC 2026',
  'allow-flight=true',
  'allow-nether=true',
  'difficulty=easy',
  'level-name=world',
  'max-players=12',
  'max-world-size=20',
  'motd=A Fabric server',
  'simulation-distance=10',
  'view-distance=20',
  '',
].join('\n');

let cookie;
/** @type {any} */
let lib;

function seed() {
  db.run(
    `UPDATE servers SET env_json = ?, heap_mb = 4096, container_memory_mb = 6144, cpus = 2,
       disk_quota_bytes = 0, pending_recreate = 0 WHERE id = ?`,
    JSON.stringify(ENV),
    ID
  );
  fs.mkdirSync(dataPath('servers', ID), { recursive: true });
  fs.writeFileSync(dataPath('servers', ID, 'server.properties'), PROPERTIES);
}

const row = () =>
  db.get(
    'SELECT display_name, env_json, heap_mb, container_memory_mb, cpus, disk_quota_bytes, update_policy, auto_start, auto_restart, quota_strict FROM servers WHERE id = ?',
    ID
  );
const properties = () => fs.readFileSync(dataPath('servers', ID, 'server.properties'), 'utf8');

test.before(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/js/lib/settingsChanges.js'), 'utf8');
  lib = await import(`data:text/javascript,${encodeURIComponent(src)}`);
  await app.start();
  cookie = await app.adminCookie();
  app.seedServer(ID);
});
test.after(() => app.stop());
test.beforeEach(seed);

const unescape = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x3D;/g, '=')
    .replace(/&#x60;/g, '`')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? unescape(m[1]) : undefined;
};

/** The settings tab as the browser gets it: the env island and every control. */
async function loadSettingsPage() {
  const page = await app.req('GET', `/servers/${ID}/settings`, { cookie });
  assert.equal(page.status, 200);
  const rootTag = page.text.match(/<div[^>]*data-settings-server="[^"]*"[^>]*>/)[0];
  const env = JSON.parse(attr(rootTag, 'data-settings-env'));
  const fields = {};
  for (const [tag] of page.text.matchAll(/<(?:input|select|textarea)\b[^>]*data-catalog-key="[^"]*"[^>]*>/g)) {
    if (attr(tag, 'data-catalog-scope') !== 'env') continue;
    fields[attr(tag, 'data-catalog-key')] = {
      type: attr(tag, 'data-catalog-type'),
      default: attr(tag, 'data-catalog-default'),
    };
  }
  const own = {};
  for (const id of ['st-heap', 'st-cmem', 'st-cpu', 'st-quota']) {
    own[id] = attr(page.text.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0], 'value');
  }
  return { html: page.text, env, fields, own };
}

/** What every advanced field shows on that page (the page's own rule). */
function shown(fields, env) {
  const out = {};
  for (const [key, field] of Object.entries(fields)) {
    out[key] = { type: field.type, value: lib.renderedValue(field, env, key) };
  }
  return out;
}

test('every control on the settings tab is kept out of the browser form restore', async () => {
  const { html } = await loadSettingsPage();
  const controls = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*(?:data-catalog-key|id="st-)[^>]*>/g)].map(
    (m) => m[0]
  );
  assert.ok(controls.length > 40, `found ${controls.length} controls`);
  const restorable = controls.filter((tag) => !/\sautocomplete="off"/.test(tag) && !/id="st-quota-strict"/.test(tag));
  assert.deepEqual(restorable, [], 'a browser reload can put another field value into these');
});

test('emptying max world size takes max-world-size out of server.properties, and nothing else', async () => {
  const { env, fields } = await loadSettingsPage();
  const before = shown(fields, env);
  assert.equal(before.MAX_WORLD_SIZE.value, '20');
  const after = structuredClone(before);
  after.MAX_WORLD_SIZE.value = '';
  const { env: next, changed } = lib.mergeEnvChanges(env, before, after);
  assert.deepEqual(changed, ['MAX_WORLD_SIZE']);

  const r = await app.req('PATCH', `/api/servers/${ID}`, { cookie, body: { env: next } });
  assert.equal(r.status, 200, r.text);
  const { MAX_WORLD_SIZE, ...rest } = ENV;
  assert.equal(MAX_WORLD_SIZE, '20');
  assert.deepEqual(JSON.parse(row().env_json), rest);
  assert.equal(properties(), PROPERTIES.replace('max-world-size=20\n', ''));
});

test('changing one setting moves that one only: every other env key and property line stays', async () => {
  const start = row();
  const { env, fields } = await loadSettingsPage();
  const before = shown(fields, env);
  const after = structuredClone(before);
  after.SIMULATION_DISTANCE.value = '8';
  const { env: next, changed } = lib.mergeEnvChanges(env, before, after);
  assert.deepEqual(changed, ['SIMULATION_DISTANCE']);

  const r = await app.req('PATCH', `/api/servers/${ID}`, { cookie, body: { env: next } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(JSON.parse(row().env_json), { ...ENV, SIMULATION_DISTANCE: '8' });
  assert.deepEqual({ ...row(), env_json: null }, { ...start, env_json: null });
  // The image writes the new value at the next start; the panel leaves the file alone.
  assert.equal(properties(), PROPERTIES);
});

test('a save with nothing changed sends no env, so a default the page shows is never written', async () => {
  const { env, fields } = await loadSettingsPage();
  const before = shown(fields, env);
  // Enum fields with a default render showing it (Game mode: Survival and so on).
  assert.ok(
    Object.values(before).some((f) => f.type === 'enum' && f.value),
    'an enum shows its default'
  );
  const { changed } = lib.mergeEnvChanges(env, before, structuredClone(before));
  assert.deepEqual(changed, []);
});

test('changing only the CPU limit saves the CPU only: memory, env and server.properties stay', async () => {
  const start = row();
  const { own } = await loadSettingsPage();
  assert.deepEqual(own, { 'st-heap': '4096', 'st-cmem': '6144', 'st-cpu': '2', 'st-quota': '0' });
  const changed = lib.changedKeys(own, { ...own, 'st-cpu': '4' });
  assert.deepEqual(changed, ['st-cpu']);

  const r = await app.req('PATCH', `/api/servers/${ID}`, { cookie, body: { cpus: 4 } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual({ ...row() }, { ...start, cpus: 4 });
  assert.equal(properties(), PROPERTIES);
});

test('a property the env never set is left in server.properties when another key is cleared', async () => {
  // allow-nether and difficulty are only in the file (no env var): clearing
  // ALLOW_FLIGHT takes allow-flight out and leaves those two alone.
  const { ALLOW_FLIGHT, ...rest } = ENV;
  assert.equal(ALLOW_FLIGHT, 'true');
  const r = await app.req('PATCH', `/api/servers/${ID}`, { cookie, body: { env: rest } });
  assert.equal(r.status, 200, r.text);
  assert.equal(properties(), PROPERTIES.replace('allow-flight=true\n', ''));
  // And a server with no server.properties yet saves fine.
  fs.rmSync(dataPath('servers', ID, 'server.properties'));
  const again = await app.req('PATCH', `/api/servers/${ID}`, { cookie, body: { env: { MOTD: 'x' } } });
  assert.equal(again.status, 200, again.text);
  assert.equal(fs.existsSync(dataPath('servers', ID, 'server.properties')), false);
});
