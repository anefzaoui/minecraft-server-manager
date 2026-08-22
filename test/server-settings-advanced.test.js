'use strict';

// Regression coverage for the post-creation "Advanced settings" section on the
// server Settings tab: every catalog field configurable at creation should be
// editable after creation too, except what's covered elsewhere (identity/
// flavor/resources cards, the Players tab's live whitelist/ops, World
// Controls' live difficulty/PvP, and the MOTD field itself).

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  app.seedServer('srv_adv01');
  db.run(
    'UPDATE servers SET env_json = ? WHERE id = ?',
    JSON.stringify({ MOTD: 'Hi', DIFFICULTY: 'normal', PVP: 'true', ALLOW_FLIGHT: 'true', MAX_PLAYERS: '15' }),
    'srv_adv01'
  );
});

test.after(async () => {
  await app.stop();
});

test('settings tab renders the advanced catalog with the right exclusions', async () => {
  const r = await app.req('GET', '/servers/srv_adv01/settings', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /id="st-advanced"/);

  // Section-level: identity/flavor/resources (own cards) and players (live
  // on the Players tab) must never appear in the advanced catalog here.
  for (const key of ['WHITELIST', 'OPS', 'VERSION', 'PAPER_BUILD']) {
    assert.doesNotMatch(r.text, new RegExp(`data-catalog-key="${key}"`), `${key} should be excluded`);
  }
  // Field-level within gameplay: DIFFICULTY/PVP (live via World Controls) and
  // MOTD (its own field above) are excluded; the rest of gameplay is kept.
  for (const key of ['DIFFICULTY', 'PVP', 'MOTD']) {
    assert.doesNotMatch(r.text, new RegExp(`data-catalog-key="${key}"`), `${key} should be excluded`);
  }
  for (const key of ['MAX_PLAYERS', 'ALLOW_FLIGHT', 'ONLINE_MODE', 'ENABLE_RCON']) {
    assert.match(r.text, new RegExp(`data-catalog-key="${key}"`), `${key} should be present`);
  }
  // Hidden catalog fields (panel-managed secrets) must never leak in either.
  for (const key of ['RCON_PASSWORD', 'SERVER_PORT', 'RCON_PORT']) {
    assert.doesNotMatch(r.text, new RegExp(`data-catalog-key="${key}"`), `${key} is hidden and must not render`);
  }

  // The Handlebars `default` helper/property-name collision (data-catalog-default
  // always rendering "[object Object]") must stay fixed.
  assert.doesNotMatch(r.text, /object Object/);
  // A real boolean default renders as a real value, not the broken placeholder.
  assert.match(r.text, /data-catalog-key="ENABLE_RCON"[^>]*data-catalog-default="true"/);
});

test('PATCH merges a changed catalog field over the existing env without clobbering it', async () => {
  const patch = await app.req('PATCH', '/api/servers/srv_adv01', {
    cookie,
    body: { env: { MOTD: 'Hi', DIFFICULTY: 'normal', PVP: 'true', ALLOW_FLIGHT: 'true', MAX_PLAYERS: '32' } },
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.json.needsRecreate, true);

  const row = db.get('SELECT env_json FROM servers WHERE id = ?', 'srv_adv01');
  const env = JSON.parse(row.env_json);
  assert.equal(env.MAX_PLAYERS, '32');
  assert.equal(env.MOTD, 'Hi'); // untouched keys survive the merge
  assert.equal(env.ALLOW_FLIGHT, 'true');
});
