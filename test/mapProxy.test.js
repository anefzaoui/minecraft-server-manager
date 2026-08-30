'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

/** Enable "BlueMap" on a seeded server, pointed at a given host port. */
function enableMap(serverId, hostPort) {
  db.run(
    "INSERT INTO integrations (server_id, kind, enabled, config_json) VALUES (?, 'bluemap', 1, ?)",
    serverId,
    JSON.stringify({ hostPort })
  );
}

function listenOnFreePort(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

test('GET /map/:id/ 404s when the map is not enabled', async () => {
  const id = app.seedServer('srv_map01');
  const r = await app.req('GET', `/map/${id}/`, { cookie });
  assert.equal(r.status, 404);
});

test('GET /map/:id/ 404s for an unknown server', async () => {
  const r = await app.req('GET', '/map/nope/', { cookie });
  assert.equal(r.status, 404);
});

test('GET /map/:id/ proxies through to the upstream BlueMap server (host-port fallback - no Docker in this test env)', async () => {
  const id = app.seedServer('srv_map02');
  const upstream = await listenOnFreePort((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Bluemap': 'yes' });
    res.end('hello from bluemap');
  });
  enableMap(id, upstream.address().port);
  try {
    const r = await app.req('GET', `/map/${id}/`, { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.text, 'hello from bluemap');
  } finally {
    upstream.close();
  }
});

test('GET /map/:id/ returns 502 (not a hang) when nothing is listening on the configured port', async () => {
  const id = app.seedServer('srv_map03');
  const srv = await listenOnFreePort(() => {});
  const deadPort = srv.address().port;
  await new Promise((resolve) => srv.close(resolve)); // free the port, guaranteed nothing listens there
  enableMap(id, deadPort);

  const r = await app.req('GET', `/map/${id}/`, { cookie });
  assert.equal(r.status, 502);
  assert.match(r.text, /not responding/);
});

test('a working target is cached - a second request does not re-probe (same upstream serves it again)', async () => {
  const id = app.seedServer('srv_map04');
  let hits = 0;
  const upstream = await listenOnFreePort((req, res) => {
    hits += 1;
    res.writeHead(200);
    res.end('ok');
  });
  enableMap(id, upstream.address().port);
  try {
    const first = await app.req('GET', `/map/${id}/`, { cookie });
    const second = await app.req('GET', `/map/${id}/`, { cookie });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(hits, 2); // both requests reached the SAME upstream, proving the cached target was reused
  } finally {
    upstream.close();
  }
});
