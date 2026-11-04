'use strict';

// A scheduled backup is redundant only when the server is cleanly stopped, a
// backup exists from after it stopped, and no data-changing event happened since.
// Anything uncertain must fail open.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const containers = require('../src/docker/containers');

let info = {};
containers.inspectStatus = async () => {
  if (info instanceof Error) throw info;
  return info;
};
const { isScheduledBackupRedundant } = require('../src/services/backups');

test.beforeEach(() => {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES ('srv_r', 'Redundant Test', 'PAPER', 25701, 26701, 'x', 1024, 1536, 'stopped')`
  );
});

test.afterEach(() => {
  db.run('DELETE FROM events');
  db.run('DELETE FROM backups');
  db.run('DELETE FROM servers');
});

function seedEvent(type, createdAt) {
  db.run(
    `INSERT INTO events (server_id, actor, type, summary, created_at) VALUES ('srv_r', 'system', ?, 'x.', ?)`,
    type,
    createdAt
  );
}

function seedBackup(createdAt) {
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, created_at)
     VALUES ('bk_r', 'srv_r', 'a.zip', 'backups/srv_r/a.zip', 1, 'scheduled', ?)`,
    createdAt
  );
  seedEvent('backup-created', createdAt);
}

const stopped = (finishedAt) => ({ exists: true, status: 'stopped', finishedAt });

test('skips when stopped and the newest backup is newer than the stop', async () => {
  seedBackup('2026-01-02 00:00:00');
  info = stopped('2026-01-01T12:00:00.123456789Z');
  assert.equal(await isScheduledBackupRedundant('srv_r'), true);
});

test('does not skip when the server ran after the last backup', async () => {
  seedBackup('2026-01-01 00:00:00');
  info = stopped('2026-01-01T12:00:00Z');
  assert.equal(await isScheduledBackupRedundant('srv_r'), false);
});

test('does not skip when there is no backup yet', async () => {
  info = stopped('2026-01-01T12:00:00Z');
  assert.equal(await isScheduledBackupRedundant('srv_r'), false);
});

test('does not skip a running or crashed server', async () => {
  seedBackup('2026-01-02 00:00:00');
  for (const status of ['running', 'starting', 'unhealthy', 'crashed']) {
    info = { exists: true, status, finishedAt: '2026-01-01T12:00:00Z' };
    assert.equal(await isScheduledBackupRedundant('srv_r'), false, status);
  }
});

test('fails open on a missing container, bad timestamp, or Docker error', async () => {
  seedBackup('2026-01-02 00:00:00');
  info = { exists: false, status: 'stopped' };
  assert.equal(await isScheduledBackupRedundant('srv_r'), false);
  info = stopped('garbage');
  assert.equal(await isScheduledBackupRedundant('srv_r'), false);
  info = new Error('docker down');
  assert.equal(await isScheduledBackupRedundant('srv_r'), false);
});

test('does not skip after a change made while stopped (file edit, pack apply, unknown type)', async () => {
  info = stopped('2026-01-01T12:00:00Z');
  for (const type of ['file-written', 'pack-pinned', 'mod-installed', 'some-future-event']) {
    db.run('DELETE FROM events');
    db.run('DELETE FROM backups');
    seedBackup('2026-01-02 00:00:00');
    seedEvent(type, '2026-01-02 06:00:00');
    assert.equal(await isScheduledBackupRedundant('srv_r'), false, type);
  }
});

test('still skips when only non-data events happened since the backup', async () => {
  seedBackup('2026-01-02 00:00:00');
  seedEvent('schedule-fired', '2026-01-03 00:00:00');
  seedEvent('update-check', '2026-01-03 00:00:00');
  info = stopped('2026-01-01T12:00:00Z');
  assert.equal(await isScheduledBackupRedundant('srv_r'), true);
});

test('a change before the backup does not block the skip', async () => {
  seedEvent('file-written', '2026-01-01 18:00:00');
  seedBackup('2026-01-02 00:00:00');
  info = stopped('2026-01-01T12:00:00Z');
  assert.equal(await isScheduledBackupRedundant('srv_r'), true);
});

test('does not skip when event history was pruned past the backup', async () => {
  seedBackup('2026-01-02 00:00:00');
  db.run('DELETE FROM events');
  info = stopped('2026-01-01T12:00:00Z');
  assert.equal(await isScheduledBackupRedundant('srv_r'), false);
});
