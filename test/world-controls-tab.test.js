'use strict';

// World Controls lives on the World tab and nowhere else: the every-tab rail
// is gone, so the overview and console pages must not render it while the
// worlds page must (controls card plus the new border/number sections).

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;
let port = 26800;

function seed(id) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, ?, 'PAPER', '1.21.4', ?, ?, 'x', 1024, 1536, 'stopped', '{}')`,
    id,
    id,
    port,
    port + 1
  );
  return id;
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('the World tab renders the controls card with the new sections', async () => {
  const id = seed('srv_wc_tab');
  const r = await app.req('GET', `/servers/${id}/worlds`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /data-world-controls/);
  assert.match(r.text, /data-wc-border-set/);
  assert.match(r.text, /data-wc-border-add/);
  assert.match(r.text, /data-wc-border-center/);
  assert.match(r.text, /data-wc-int="randomTickSpeed"/);
  // Gamerules render as toggle switches, pick-one groups as dropdowns - no
  // chip-style toggles remain.
  assert.match(r.text, /msm-toggle/);
  assert.match(r.text, /data-wc-select="difficulty"/);
  assert.match(r.text, /data-wc-select="weather"/);
  assert.match(r.text, /data-wc-select="time"/);
  assert.doesNotMatch(r.text, /chip" data-wc-toggle/);
  assert.match(r.text, /Worlds on This Server/);
});

test('other tabs no longer render world controls', async () => {
  const id = seed('srv_wc_notabs');
  for (const tab of ['overview', 'console', 'players', 'backups']) {
    const r = await app.req('GET', `/servers/${id}/${tab}`, { cookie });
    assert.equal(r.status, 200, `${tab} renders`);
    assert.doesNotMatch(r.text, /data-world-controls/, `${tab} must not carry world controls`);
  }
});
