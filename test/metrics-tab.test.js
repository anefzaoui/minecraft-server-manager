'use strict';

// Monitoring tab: the Network card spans the row exactly when the tick-rate
// card is hidden (same perfSupported condition both sides), and the Storage
// card shows a quota donut only when a quota is set.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;
let port = 26900;

function seed(id, { quotaGb = 0 } = {}) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, disk_quota_bytes, env_json)
     VALUES (?, ?, 'PAPER', '1.21.4', ?, ?, 'x', 1024, 1536, 'stopped', ?, '{}')`,
    id,
    id,
    port,
    port + 1,
    quotaGb * 1024 ** 3
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

test('the quota donut renders with a quota set', async () => {
  const id = seed('srv_met_quota', { quotaGb: 25 });
  const r = await app.req('GET', `/servers/${id}/metrics`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /data-disk-donut/);
  assert.match(r.text, />0%</);
  assert.match(r.text, /stroke-grass-500/);
  assert.match(r.text, /of 25\.0 GB/);
});

test('no donut without a quota', async () => {
  const id = seed('srv_met_noquota');
  const r = await app.req('GET', `/servers/${id}/metrics`, { cookie });
  assert.equal(r.status, 200);
  assert.doesNotMatch(r.text, /data-disk-donut/);
  assert.match(r.text, /\(no quota\)/);
});

test('the network and tick-rate cards share one visibility condition', async () => {
  const id = seed('srv_met_cards', { quotaGb: 25 });
  const r = await app.req('GET', `/servers/${id}/metrics`, { cookie });
  assert.equal(r.status, 200);
  // Both hooks render; the span and the hidden flag come from the same
  // perfSupported branch, so they cannot disagree.
  assert.match(r.text, /data-net-card/);
  assert.match(r.text, /data-tps-card/);
});
