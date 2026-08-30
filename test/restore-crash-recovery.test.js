'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');
const { ensureDataRoot } = require('../src/storage/dataRoot');

// A restore swaps the world with two renames: serverDir -> displaced sibling,
// then staged -> serverDir. If the panel dies between those renames, the
// displaced sibling is the only copy of the world. These tests pin the two
// boot-recovery behaviors: put the world back after a crashed swap, and clear
// leftover displaced copies once a restore actually completed.

const serversDir = () => path.join(config.dataDir, 'servers');

function writeWorld(dir, marker) {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'world', 'level.dat'), marker);
}

test('boot recovers a world displaced by a restore that crashed mid-swap', () => {
  ensureDataRoot();
  const serverId = 'srv_crashswap1';
  const displaced = path.join(serversDir(), `.restore-displaced-${serverId}-${Date.now().toString(36)}`);
  // Crashed-swap state: the displaced copy exists, the server dir does not.
  writeWorld(displaced, 'the-real-world');
  fs.rmSync(path.join(serversDir(), serverId), { recursive: true, force: true });

  ensureDataRoot();

  const restored = path.join(serversDir(), serverId, 'world', 'level.dat');
  assert.equal(fs.existsSync(displaced), false, 'displaced dir should be gone');
  assert.equal(fs.readFileSync(restored, 'utf8'), 'the-real-world');
  fs.rmSync(path.join(serversDir(), serverId), { recursive: true, force: true });
});

test('boot removes a leftover displaced copy when the restore completed', () => {
  ensureDataRoot();
  const serverId = 'srv_crashswap2';
  const serverDir = path.join(serversDir(), serverId);
  const displaced = path.join(serversDir(), `.restore-displaced-${serverId}-${Date.now().toString(36)}`);
  // Completed-restore state: both exist; the displaced copy is debris.
  writeWorld(serverDir, 'restored-world');
  writeWorld(displaced, 'old-world-debris');

  ensureDataRoot();

  assert.equal(fs.existsSync(displaced), false, 'leftover displaced dir should be removed');
  assert.equal(fs.readFileSync(path.join(serverDir, 'world', 'level.dat'), 'utf8'), 'restored-world');
  fs.rmSync(serverDir, { recursive: true, force: true });
});

test('recovery parses a server id that itself contains dashes', () => {
  ensureDataRoot();
  const serverId = 'srv_ab-cd_ef';
  const displaced = path.join(serversDir(), `.restore-displaced-${serverId}-${Date.now().toString(36)}`);
  writeWorld(displaced, 'dashed-id-world');
  fs.rmSync(path.join(serversDir(), serverId), { recursive: true, force: true });

  ensureDataRoot();

  const restored = path.join(serversDir(), serverId, 'world', 'level.dat');
  assert.equal(fs.readFileSync(restored, 'utf8'), 'dashed-id-world');
  fs.rmSync(path.join(serversDir(), serverId), { recursive: true, force: true });
});
