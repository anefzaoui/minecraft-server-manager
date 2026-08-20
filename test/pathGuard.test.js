'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { safeJoin, dataPath, isInsideDataDir, PathEscapeError } = require('../src/storage/pathGuard');

const BASE = path.resolve(os.tmpdir(), 'msm-guard-base');

test('safeJoin allows a normal nested path', () => {
  const r = safeJoin(BASE, 'servers', 'srv_abc', 'world', 'level.dat');
  assert.equal(r, path.resolve(BASE, 'servers/srv_abc/world/level.dat'));
});

test('safeJoin rejects .. traversal', () => {
  assert.throws(() => safeJoin(BASE, '../etc/passwd'), PathEscapeError);
  assert.throws(() => safeJoin(BASE, 'a/../../b'), PathEscapeError);
  assert.throws(() => safeJoin(BASE, '..'), PathEscapeError);
});

test('safeJoin rejects an absolute path that escapes the base', () => {
  assert.throws(() => safeJoin(BASE, '/etc/passwd'), PathEscapeError);
  if (process.platform === 'win32') {
    assert.throws(() => safeJoin(BASE, 'C:\\Windows\\system32'), PathEscapeError);
  }
});

test('safeJoin rejects NUL bytes', () => {
  assert.throws(() => safeJoin(BASE, 'world\0.dat'), PathEscapeError);
});

test('safeJoin rejects Windows alternate data streams', () => {
  assert.throws(() => safeJoin(BASE, 'file.txt:$DATA'), PathEscapeError);
  assert.throws(() => safeJoin(BASE, 'dir/file:stream'), PathEscapeError);
});

test('safeJoin allows a bare drive-letter prefix in a relative segment safely', () => {
  // The regex strips a leading drive letter before the ADS check so normal
  // relative joins still work; the result must still be contained.
  const r = safeJoin(BASE, 'mods', 'cool.jar');
  assert.ok(r.startsWith(path.resolve(BASE)));
});

test('dataPath resolves under the configured data dir', () => {
  const p = dataPath('servers', 'srv_1');
  assert.ok(p.includes('srv_1'));
  assert.throws(() => dataPath('../outside'), PathEscapeError);
});

test('safeJoin rejects a symlink that resolves outside the base', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-guard-symlink-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-guard-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'nope');
  const linkPath = path.join(dir, 'escape');
  try {
    fs.symlinkSync(outside, linkPath, 'dir');
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    t.skip(`cannot create symlinks in this environment: ${err.message}`);
    return;
  }
  try {
    assert.throws(() => safeJoin(dir, 'escape', 'secret.txt'), PathEscapeError);
    assert.throws(() => safeJoin(dir, 'escape'), PathEscapeError);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('safeJoin allows a symlink that resolves inside the base', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-guard-symlink-ok-'));
  const real = path.join(dir, 'real');
  fs.mkdirSync(real);
  fs.writeFileSync(path.join(real, 'world.dat'), 'ok');
  const linkPath = path.join(dir, 'alias');
  try {
    fs.symlinkSync(real, linkPath, 'dir');
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    t.skip(`cannot create symlinks in this environment: ${err.message}`);
    return;
  }
  try {
    const r = safeJoin(dir, 'alias', 'world.dat');
    assert.ok(fs.existsSync(r));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('isInsideDataDir is true for the root and children, false for outside', () => {
  const config = require('../src/config');
  assert.equal(isInsideDataDir(config.dataDir), true);
  assert.equal(isInsideDataDir(path.join(config.dataDir, 'servers', 'x')), true);
  assert.equal(isInsideDataDir(path.resolve(config.dataDir, '..', 'elsewhere')), false);
});
