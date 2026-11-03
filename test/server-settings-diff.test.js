'use strict';

// Settings save-confirmation (#4): the changes-preview endpoint and the
// summarizeServerChanges/computeServerDiff pure diff behind it. The preview is
// read-only and must never mutate the row, and its rows must agree with what
// the PATCH will apply (same schema, same diff logic).

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const servers = require('../src/services/servers');
const { getField } = require('../src/config/field-catalog');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  app.seedServer('diff01');
  db.run(
    'UPDATE servers SET env_json = ? WHERE id = ?',
    JSON.stringify({ MOTD: 'Hi', MAX_PLAYERS: '15', ALLOW_FLIGHT: 'true' }),
    'diff01'
  );
});

test.after(async () => {
  await app.stop();
});

test('a mixed change set produces labelled rows and needsRecreate', async () => {
  const r = await app.req('POST', '/api/servers/diff01/changes-preview', {
    cookie,
    body: { name: 'Renamed', heapMb: 2048 },
  });
  assert.equal(r.status, 200);
  const labels = r.json.changes.map((c) => c.label);
  assert.ok(labels.includes('Display name'), `should list the renamed display name, got ${labels}`);
  assert.ok(labels.includes('Java heap'), `should list the heap change, got ${labels}`);
  assert.equal(r.json.needsRecreate, true);
  const heapRow = r.json.changes.find((c) => c.label === 'Java heap');
  assert.equal(heapRow.before, 1024);
  assert.equal(heapRow.after, 2048);
  assert.equal(heapRow.requiresRebuild, true);
  assert.equal(r.json.changes.find((c) => c.label === 'Display name').requiresRebuild, false);
});

test('cosmetic-only changes do not flag a rebuild', async () => {
  const r = servers.summarizeServerChanges('diff01', { name: 'Just a rename', description: 'notes' });
  assert.equal(r.needsRecreate, false);
  assert.ok(r.changes.every((c) => !c.requiresRebuild));
});

test('empty or identical changes produce no rows', async () => {
  assert.deepEqual(servers.summarizeServerChanges('diff01', {}).changes, []);
  assert.deepEqual(servers.summarizeServerChanges('diff01', { name: 'Test Server' }).changes, []);
});

test('tags and the disk quota sent unchanged with every save are not listed', async () => {
  const row = db.get('SELECT tags_json, disk_quota_bytes FROM servers WHERE id = ?', 'diff01');
  const tags = JSON.parse(row.tags_json || '[]');
  const quotaGb = (row.disk_quota_bytes || 0) / 1024 ** 3;
  const r = servers.summarizeServerChanges('diff01', { tags: [...tags].reverse(), diskQuotaGb: quotaGb });
  assert.deepEqual(r.changes, [], 'same tags (any order) and same quota are no change');
  const changed = servers.summarizeServerChanges('diff01', { tags: [...tags, 'new-tag'], diskQuotaGb: quotaGb + 5 });
  assert.deepEqual(changed.changes.map((c) => c.label).sort(), ['Disk quota', 'Tags']);
});

test('env differences expand per key, with catalog labels, additions and deletions', async () => {
  const r = servers.summarizeServerChanges('diff01', {
    env: { MOTD: 'Hello there', MAX_PLAYERS: '15', MEMORY: '1G' },
  });
  const byLabel = Object.fromEntries(r.changes.map((c) => [c.label, c]));
  assert.equal(r.needsRecreate, true);
  // MOTD gets its catalog label, not the raw env key.
  const motd = byLabel['Server list message (MOTD)'];
  assert.equal(motd.before, 'Hi');
  assert.equal(motd.after, 'Hello there');
  assert.equal(motd.requiresRebuild, true);
  // ALLOW_FLIGHT is dropped from the incoming env → reported as deleted, under
  // its catalog label (read from the catalog so a casing change there is fine).
  const allowFlight = byLabel[getField('env', 'ALLOW_FLIGHT').label];
  assert.equal(allowFlight.before, 'true');
  assert.equal(allowFlight.after, null);
  // MEMORY (catalog label 'RAM (Java heap)') is brand new.
  assert.equal(byLabel['RAM (Java heap)'].before, null);
  assert.equal(byLabel['RAM (Java heap)'].after, '1G');
  // Unchanged keys produce no row at all.
  assert.ok(!('MAX_PLAYERS' in byLabel), 'unchanged env keys should not be listed');
});

test('extra port mappings and volume binds report their real before/after counts', async () => {
  db.run(
    'UPDATE servers SET extra_ports_json = ?, extra_binds_json = ? WHERE id = ?',
    JSON.stringify([{ containerPort: 9000, hostPort: 9100, protocol: 'tcp' }]),
    JSON.stringify([{ hostPath: '/tmp/a', containerPath: '/b', mode: 'rw' }]),
    'diff01'
  );
  const r = servers.summarizeServerChanges('diff01', {
    extraPorts: [
      { containerPort: 9000, hostPort: 9100, protocol: 'tcp' },
      { containerPort: 9001, hostPort: 9101, protocol: 'tcp' },
    ],
    extraBinds: [],
  });
  const ports = r.changes.find((c) => c.label === 'Extra port mappings');
  const binds = r.changes.find((c) => c.label === 'Extra volume binds');
  assert.ok(ports, 'port row present');
  assert.ok(binds, 'bind row present');
  assert.equal(ports.before, '1', 'before count comes from the stored list');
  assert.equal(ports.after, '2', 'after count comes from the incoming list');
  assert.equal(ports.requiresRebuild, true);
  assert.equal(binds.before, '1', 'bind before count comes from the stored list');
  assert.equal(binds.after, '0', 'clearing the binds reports zero');
});

test('the preview refuses a loader-unsupported Minecraft version, matching the PATCH', async () => {
  const realFetch = globalThis.fetch;
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES ('mojang-version-manifest', ?, datetime('now'))`,
    JSON.stringify({
      latest: { release: '26.3' },
      versions: [
        { id: '26.3', type: 'release' },
        { id: '26.2', type: 'release' },
      ],
    })
  );
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('fill.papermc.io')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  };
  app.seedServer('diff_gate');
  db.run("UPDATE servers SET mc_version = '26.2' WHERE id = ?", 'diff_gate');
  try {
    const refused = await app.req('POST', '/api/servers/diff_gate/changes-preview', {
      cookie,
      body: { mcVersion: '26.3' },
    });
    assert.equal(refused.status, 409, 'preview must refuse an unsupported Paper MC version');
    assert.match(refused.json.error, /has not published a Minecraft 26\.3 build yet/);
    const allowed = await app.req('POST', '/api/servers/diff_gate/changes-preview', {
      cookie,
      body: { mcVersion: '26.2' },
    });
    assert.equal(allowed.status, 200, 'a supported version still previews');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a pack-pinning conflict throws the same error the PATCH would', async () => {
  app.seedServer('diff_pin');
  db.run("UPDATE servers SET type = 'MODRINTH' WHERE id = ?", 'diff_pin');
  assert.throws(
    () => servers.summarizeServerChanges('diff_pin', { env: { MODRINTH_MODPACK: 'https://modrinth.com/modpack/foo' } }),
    (err) => err.status === 400 && /MODRINTH_VERSION/.test(err.message)
  );
});

test('the preview endpoint never mutates the row', async () => {
  const before = db.get('SELECT * FROM servers WHERE id = ?', 'diff01');
  const r = await app.req('POST', '/api/servers/diff01/changes-preview', {
    cookie,
    body: {
      name: 'Should not stick',
      heapMb: 8192,
      env: { MOTD: 'Temporary', MAX_PLAYERS: '15', ALLOW_FLIGHT: 'true' },
    },
  });
  assert.equal(r.status, 200);
  assert.ok(r.json.changes.length > 0);
  const after = db.get('SELECT * FROM servers WHERE id = ?', 'diff01');
  assert.deepEqual(after, before, 'preview must leave the stored row untouched');
});

test('an unauthenticated preview request is blocked (method-based write gate)', async () => {
  const r = await app.req('POST', '/api/servers/diff01/changes-preview', { body: { name: 'nope' } });
  // No session → no user → requireWrite bounces the request like the PATCH does.
  assert.notEqual(r.status, 200);
});
