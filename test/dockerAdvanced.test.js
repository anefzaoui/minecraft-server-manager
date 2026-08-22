'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const dockerSpec = require('../src/services/dockerSpec');
const { isPortFree } = require('../src/services/ports');
const app = require('./helpers/app');

// ---- dockerSpec: YAML round trip -------------------------------------------

test('toYaml/fromYaml round-trips only the 4 editable fields', () => {
  const spec = {
    containerName: 'survival-smp',
    network: 'proxy-net',
    image: 'itzg/minecraft-server:latest',
    resources: { memoryMb: 4096, swapMb: 0, cpus: 0 },
    ports: {
      game: 25565,
      rcon: 26565,
      bedrock: null,
      extra: [{ hostPort: 19132, containerPort: 19132, protocol: 'udp', label: 'Bedrock' }],
    },
    volumes: { data: '/data', extra: [{ hostPath: '/opt/extra', containerPath: '/extra', mode: 'rw' }] },
    env: { EULA: 'TRUE' },
  };
  const yaml = dockerSpec.toYaml(spec);
  assert.match(yaml, /containerName: survival-smp/);
  const parsed = dockerSpec.fromYaml(yaml);
  assert.deepEqual(parsed, {
    containerName: 'survival-smp',
    networkName: 'proxy-net',
    extraPorts: [{ hostPort: 19132, containerPort: 19132, protocol: 'udp', label: 'Bedrock' }],
    extraBinds: [{ hostPath: '/opt/extra', containerPath: '/extra', mode: 'rw' }],
  });
});

test('fromYaml rejects invalid YAML', () => {
  assert.throws(() => dockerSpec.fromYaml('not: [valid'), /Invalid YAML/);
});

test('fromYaml rejects a non-mapping document', () => {
  assert.throws(() => dockerSpec.fromYaml('- just\n- a\n- list'), /expected a mapping/);
});

// ---- dockerSpec: validateOverrides -----------------------------------------

test('validateOverrides rejects a malformed container name', async () => {
  await assert.rejects(() => dockerSpec.validateOverrides({ containerName: '-bad!' }), /Container name/);
});

test('validateOverrides accepts an unset containerName/network (defaults)', async () => {
  await assert.doesNotReject(() => dockerSpec.validateOverrides({}));
});

test('validateOverrides reserves the msm- prefix (would let a name shadow another server’s container)', async () => {
  await assert.rejects(() => dockerSpec.validateOverrides({ containerName: 'msm-hijack' }), /reserved/);
  await assert.rejects(() => dockerSpec.validateOverrides({ containerName: 'MSM-hijack' }), /reserved/);
});

test('validateOverrides rejects duplicate host ports without ever probing the OS', async () => {
  // previousExtraPorts marks 20000 as already legitimately held by this
  // server, so the free-port probe is skipped for both entries - only the
  // in-request dedup check should fire, keeping this test hermetic.
  await assert.rejects(
    () =>
      dockerSpec.validateOverrides(
        {
          extraPorts: [
            { hostPort: 20000, containerPort: 1, protocol: 'tcp' },
            { hostPort: 20000, containerPort: 2, protocol: 'tcp' },
          ],
        },
        { previousExtraPorts: [{ hostPort: 20000 }] }
      ),
    /used by more than one/
  );
});

test('validateOverrides rejects an out-of-range or malformed port entry', async () => {
  await assert.rejects(
    () => dockerSpec.validateOverrides({ extraPorts: [{ hostPort: 80, containerPort: 1, protocol: 'tcp' }] }),
    /invalid host port/
  );
  await assert.rejects(
    () => dockerSpec.validateOverrides({ extraPorts: [{ hostPort: 20001, containerPort: 1, protocol: 'ftp' }] }),
    /protocol must be/
  );
});

test('validateOverrides rejects a relative host bind path (free-form is allowed, but must be absolute)', async () => {
  await assert.rejects(
    () => dockerSpec.validateOverrides({ extraBinds: [{ hostPath: 'relative/path', containerPath: '/data' }] }),
    /invalid host path/
  );
});

test('validateOverrides accepts an absolute, non-contained host bind path (free-form by design)', async () => {
  await assert.doesNotReject(() =>
    dockerSpec.validateOverrides({ extraBinds: [{ hostPath: '/etc/anything', containerPath: '/data' }] })
  );
});

// ---- ports.js: dbPortsInUse now unions extra_ports_json + BlueMap ---------

test('isPortFree treats a server’s extra_ports_json as taken', async () => {
  app.seedServer('srv_extraport01');
  db.run(
    'UPDATE servers SET extra_ports_json = ? WHERE id = ?',
    JSON.stringify([{ hostPort: 28100, containerPort: 8100, protocol: 'tcp' }]),
    'srv_extraport01'
  );
  assert.equal(await isPortFree(28100), false);
});

test('isPortFree treats an enabled BlueMap integration port as taken', async () => {
  app.seedServer('srv_bluemap01');
  db.run(
    "INSERT INTO integrations (server_id, kind, enabled, config_json) VALUES (?, 'bluemap', 1, ?)",
    'srv_bluemap01',
    JSON.stringify({ hostPort: 28200 })
  );
  assert.equal(await isPortFree(28200), false);
});

// ---- routes: containerName validation + clear-to-default via PATCH --------

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('POST /api/servers rejects a malformed containerName before touching Docker', async () => {
  const r = await app.req('POST', '/api/servers', {
    cookie,
    body: { name: 'Bad Name', type: 'VANILLA', mcVersion: 'LATEST', start: false, containerName: '-bad name!' },
  });
  assert.equal(r.status, 400);
});

test('PATCH clears a stored container name back to default with an empty string', async () => {
  const id = app.seedServer('srv_patchname01');
  db.run("UPDATE servers SET container_name = 'msm-custom-name' WHERE id = ?", id);

  const cleared = await app.req('PATCH', `/api/servers/${id}`, { cookie, body: { containerName: '' } });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.json.server.container_name, null);
  assert.equal(cleared.json.needsRecreate, true);
});

test('PATCH rejects an invalid containerName with 400', async () => {
  const id = app.seedServer('srv_patchname02');
  const r = await app.req('PATCH', `/api/servers/${id}`, { cookie, body: { containerName: '../nope' } });
  assert.equal(r.status, 400);
});
