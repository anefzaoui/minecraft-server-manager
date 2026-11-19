'use strict';

// Regression tests for the review bug-fix pass: protected panel files in the
// global file manager, LIKE-wildcard escaping, IPv6 forms that embed a private
// IPv4 address, and role changes on a missing user.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const config = require('../src/config');
const files = require('../src/services/files');
const { escapeLike } = require('../src/events');
const { isBlockedIp } = require('../src/utils/urlGuard');
const auth = require('../src/services/auth');

test('the global file manager cannot copy, move, rename, or upload onto protected panel files', async () => {
  const dir = path.join(config.dataDir, 'review-fixes');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'note.txt'), 'hi');
  const secret = path.join(config.dataDir, '.session-secret');
  const hadSecret = fs.existsSync(secret);
  if (!hadSecret) fs.writeFileSync(secret, 'original');
  const before = fs.readFileSync(secret, 'utf8');

  await assert.rejects(files.copy(null, 'panel.db', 'review-fixes'), { status: 403 });
  await assert.rejects(files.copy(null, '.session-secret', 'review-fixes'), { status: 403 });

  fs.writeFileSync(path.join(config.dataDir, 'root-note.txt'), 'x');
  await assert.rejects(files.rename(null, 'root-note.txt', 'panel.db-journal'), { status: 403 });
  fs.writeFileSync(path.join(dir, 'panel.db-journal'), 'x');
  await assert.rejects(files.move(null, 'review-fixes/panel.db-journal', ''), { status: 403 });

  const tmp = path.join(config.dataDir, 'tmp-upload.bin');
  fs.writeFileSync(tmp, 'attacker');
  await assert.rejects(files.acceptUpload(null, '', tmp, '.session-secret'), { status: 403 });
  await assert.rejects(files.acceptUpload(null, '', tmp, 'panel.db-wal'), { status: 403 });
  assert.equal(fs.readFileSync(secret, 'utf8'), before, 'the secrets key was not replaced');
  await assert.rejects(files.mkdir(null, '.hidden-root-dir'), { status: 403 });

  // Ordinary uploads still land.
  const ok = await files.acceptUpload(null, 'review-fixes', tmp, 'plain.bin');
  assert.equal(ok.path, 'review-fixes/plain.bin');
  if (!hadSecret) fs.rmSync(secret, { force: true });
  fs.rmSync(path.join(config.dataDir, 'root-note.txt'), { force: true });
});

test('the text editor leaves no temp file behind and survives back-to-back saves', async () => {
  const sid = null;
  fs.mkdirSync(path.join(config.dataDir, 'review-edit'), { recursive: true });
  await Promise.all([
    files.writeText(sid, 'review-edit/a.txt', 'one'),
    files.writeText(sid, 'review-edit/a.txt', 'two'),
  ]);
  const left = fs.readdirSync(path.join(config.dataDir, 'review-edit'));
  assert.deepEqual(left, ['a.txt']);
});

test('escapeLike makes % and _ match literally', () => {
  assert.equal(escapeLike('50%_off\\'), '50\\%\\_off\\\\');
  const db = require('../src/db');
  const row = db.get("SELECT ('servers/abcXd/world' LIKE ? ESCAPE '\\') AS hit", `servers/${escapeLike('abc_d')}/%`);
  assert.equal(row.hit, 0, 'another server id no longer matches through the _ wildcard');
});

test('IPv6 spellings that embed a private IPv4 address are blocked', () => {
  assert.equal(isBlockedIp('::127.0.0.1'), true, 'IPv4-compatible');
  assert.equal(isBlockedIp('::7f00:1'), true, 'IPv4-compatible, hex');
  assert.equal(isBlockedIp('64:ff9b::a9fe:a9fe'), true, 'NAT64 to cloud metadata');
  assert.equal(isBlockedIp('2002:c0a8:0101::1'), true, '6to4 of 192.168.1.1');
  assert.equal(isBlockedIp('198.18.0.1'), true, 'benchmarking range');
  assert.equal(isBlockedIp('2606:4700:4700::1111'), false, 'a public IPv6 address still passes');
  assert.equal(isBlockedIp('64:ff9b::808:808'), false, 'NAT64 of a public address still passes');
});

test('changing the role of a user that does not exist is a 404, not a silent no-op', () => {
  assert.throws(() => auth.setRole('usr_missing', 'viewer'), { status: 404 });
});
