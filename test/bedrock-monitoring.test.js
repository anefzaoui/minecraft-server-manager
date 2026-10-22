'use strict';

// Public monitoring-page seam: a Native Bedrock server keeps Docker-backed
// health, resource and log views, without inheriting Java-only telemetry.
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  db.run(
    `INSERT INTO servers (id, display_name, type, runtime, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES ('srv_bedrock_monitor', 'Bedrock monitor', 'BEDROCK', 'bedrock', 'LATEST', 19132, 0, '', 1024, 1536, 'stopped')`
  );
});

test.after(async () => {
  await app.stop();
});

test('Native Bedrock monitoring retains container metrics and logs without Java telemetry', async () => {
  const metrics = await app.req('GET', '/servers/srv_bedrock_monitor/metrics', { cookie });
  assert.equal(metrics.status, 200);
  for (const label of ['Status', 'CPU', 'Memory', 'Network', 'Container health']) {
    assert.match(metrics.text, new RegExp(label), `${label} remains available for Native Bedrock`);
  }
  assert.doesNotMatch(metrics.text, /\bTPS\b|Tick Rate|ms\/tick|Java heap|Java:|Crash Reports/i);

  const consolePage = await app.req('GET', '/servers/srv_bedrock_monitor/console', { cookie });
  assert.equal(consolePage.status, 200);
  assert.match(consolePage.text, /Console/i);
});
