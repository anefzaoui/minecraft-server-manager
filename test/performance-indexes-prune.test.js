'use strict';

// Perf-audit regressions: migration 025's indexes exist, pruneEvents is bounded
// and only removes what it should (excerpts included), the fleet-wide
// listServers() no longer does the extraPorts/extraBinds JSON parse that only
// the singleton getServer() path consumes, and the crash watcher skips a server
// whose report dirs are unchanged.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

test('migration 025 adds the audit indexes', () => {
  const indexes = new Set(db.all("SELECT name FROM sqlite_master WHERE type = 'index'").map((r) => r.name));
  const expected = [
    'idx_events_server_id',
    'idx_events_server_type_id',
    'idx_events_type_id',
    'idx_crash_server_viewed',
    'idx_crash_server_mtime',
    'idx_pevents_ts',
  ];
  for (const i of expected) {
    assert.ok(indexes.has(i), `expected index ${i}`);
  }
});

test('pruneEvents removes only rows older than the cutoff, deletes their excerpts, stays no-op when empty', async () => {
  const { recordEvent, pruneEvents } = require('../src/events');

  const recent = recordEvent({ serverId: null, actor: 'system', type: 'ping', summary: 'recent' });

  const oldPlain = db.run(
    `INSERT INTO events (actor, type, summary, created_at) VALUES ('system', 'ping', 'old', datetime('now', '-400 days'))`
  ).lastInsertRowid;

  const excerptRel = path.posix.join('logs', '_panel', 'events', 'old-excerpt.log');
  const oldWithExcerpt = db.run(
    `INSERT INTO events (actor, type, summary, log_excerpt_path, created_at)
       VALUES ('system', 'ping', 'old-excerpt', ?, datetime('now', '-400 days'))`,
    excerptRel
  ).lastInsertRowid;
  fs.mkdirSync(path.dirname(dataPath(excerptRel)), { recursive: true });
  fs.writeFileSync(dataPath(excerptRel), 'captured log');

  const result = await pruneEvents(365, { actor: 'system' });
  assert.equal(result.removed, 2, 'both backdated events removed');
  assert.equal(result.excerpts, 1, 'one excerpt removed');
  assert.equal(db.get('SELECT COUNT(*) AS n FROM events WHERE id = ?', recent).n, 1, 'recent event kept');
  assert.equal(
    db.get('SELECT COUNT(*) AS n FROM events WHERE id IN (?, ?)', oldPlain, oldWithExcerpt).n,
    0,
    'old events gone'
  );
  assert.ok(!fs.existsSync(dataPath(excerptRel)), 'the excerpt file was deleted');

  const noOp = await pruneEvents(365, { actor: 'system' });
  assert.equal(noOp.removed, 0, 'nothing left to prune');
  assert.equal(
    db.get("SELECT COUNT(*) AS n FROM events WHERE type = 'events-pruned'").n,
    1,
    "the 'events-pruned' event is only recorded when something was actually pruned"
  );
});

test('listServers() is a lean parse; extra ports/binds still come from getServer()', () => {
  const servers = require('../src/services/servers');
  const id = 'srv_leantest';
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, ?, 'PAPER', 'LATEST', 25599, 26599, 'x', 1024, 1536)`,
    id,
    'Lean Test'
  );
  db.run(
    'UPDATE servers SET extra_ports_json = ?, extra_binds_json = ? WHERE id = ?',
    JSON.stringify([{ containerPort: 8123, protocol: 'tcp', hostPort: 18123 }]),
    JSON.stringify([{ hostPath: '/host', containerPath: '/cont', mode: 'rw' }]),
    id
  );

  const listed = servers.listServers().find((s) => s.id === id);
  assert.ok(listed, 'listed server present');
  assert.equal(listed.extraPorts, undefined, 'listServers does not build the extra-ports array');
  assert.equal(listed.extraBinds, undefined, 'listServers does not build the extra-binds array');

  const full = servers.getServer(id);
  assert.deepEqual(full.extraPorts, [{ containerPort: 8123, protocol: 'tcp', hostPort: 18123 }]);
  assert.equal(full.extraBinds.length, 1);
});

test('the crash watcher skips a server whose report dirs are unchanged', async () => {
  const crashes = require('../src/crashes');
  const serverId = 'srv_crashtest';
  const root = dataPath('servers', serverId);
  const crashDir = dataPath('servers', serverId, 'crash-reports');
  fs.mkdirSync(crashDir, { recursive: true });
  fs.writeFileSync(path.join(crashDir, 'crash-1.txt'), 'Description: boom\n\njava.lang.OutOfMemoryError: heap space\n');

  const first = await crashes.scanServer(serverId);
  assert.equal(first.length, 1, 'the new report is indexed');
  const second = await crashes.scanServer(serverId);
  assert.equal(second.length, 0, 'unchanged dirs are not re-scanned');
  const third = await crashes.scanServer(serverId);
  assert.equal(third.length, 0, 'stays quiet across ticks');

  // A genuinely new report is still picked up despite the gate.
  fs.writeFileSync(path.join(crashDir, 'crash-2.txt'), 'Description: also boom\n\njava.lang.NullPointerException\n');
  const fourth = await crashes.scanServer(serverId);
  assert.equal(fourth.length, 1, 'a new file after the cache primes is still found');

  fs.rmSync(root, { recursive: true, force: true });
});
