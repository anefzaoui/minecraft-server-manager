'use strict';

require('./helpers/env'); // first: points DATA_DIR at a throwaway dir before any src/ module loads
const test = require('node:test');
const assert = require('node:assert/strict');
const liveCache = require('../src/services/liveCache');

// ---------------------------------------------------------------------------
// classifyPhase - boot-pipeline detection from a log tail
// ---------------------------------------------------------------------------

test('classifyPhase returns null when nothing matches', () => {
  assert.equal(liveCache.classifyPhase('some unrelated log line\nmore output'), null);
});

test('classifyPhase detects a download phase', () => {
  const r = liveCache.classifyPhase('Downloading modpack: https://…\nprogress');
  assert.deepEqual(r, { key: 'pack-download', label: 'Downloading modpack' });
});

test('classifyPhase counts Downloaded mod file lines (plural label)', () => {
  const r = liveCache.classifyPhase('Downloaded mod file a\nDownloaded mod file b\nDownloaded mod file c');
  assert.equal(r.key, 'mods-download');
  assert.equal(r.label, 'Downloading mods (3 in the last minute)');
});

test('classifyPhase uses the singular label for a single download', () => {
  const r = liveCache.classifyPhase('Downloaded mod file a');
  assert.equal(r.key, 'mods-download');
  assert.equal(r.label, 'Downloading mods');
});

test('classifyPhase detects loader install, world-gen and done', () => {
  assert.equal(liveCache.classifyPhase('Running the NeoForge installer').key, 'loader-install');
  assert.equal(liveCache.classifyPhase('Preparing start region for dimension').key, 'world-gen');
  assert.equal(liveCache.classifyPhase('Done (12.345s)!').key, 'done');
});

test('classifyPhase latest pipeline stage wins', () => {
  // A tail that matches an earlier and a later phase must resolve to the later one.
  const r = liveCache.classifyPhase('Preparing start region\nPreparing spawn area\nDone (5.0s)!');
  assert.equal(r.key, 'done');
});

test('classifyPhase non-mod-download phases use the static label', () => {
  const r = liveCache.classifyPhase('Downloading minecraft_server.jar');
  assert.deepEqual(r, { key: 'server-download', label: 'Downloading server' });
});

// ---------------------------------------------------------------------------
// get / getAll / snapshot shape
// ---------------------------------------------------------------------------

test('get returns a frozen-ish empty snapshot for an unknown server', () => {
  const snap = liveCache.get('srv_nope');
  assert.equal(snap.stats, null);
  assert.equal(snap.players, null);
  assert.equal(snap.startedAt, null);
  assert.equal(snap.phase, null);
  assert.equal(snap.upConfirmed, false);
  assert.equal(snap.perf, null);
  assert.equal(snap.perfSupported, true);
});

test('getAll returns an empty object before any entry exists', () => {
  // startLiveCache/sync are unreachable without Docker, so nothing is attached.
  assert.deepEqual(liveCache.getAll(), {});
});

test('sampleOnce returns null when Docker stats are unavailable', async () => {
  // In this harness there is no Docker daemon, so the one-shot falls back to null.
  const result = await liveCache.sampleOnce('srv_none');
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// statusDetail - status-detail chip derivation
// ---------------------------------------------------------------------------

test('statusDetail returns the boot phase label while not yet answering rcon', () => {
  const detail = liveCache.statusDetail({
    players: null,
    phase: { key: 'world-gen', label: 'Generating world' },
    upConfirmed: false,
  });
  assert.equal(detail, 'Generating world');
});

test('statusDetail latching player-count-unavailable when up but unparseable list', () => {
  assert.equal(liveCache.statusDetail({ players: null, phase: null, upConfirmed: true }), 'Player count unavailable');
});

test('statusDetail returns null when nothing to show', () => {
  assert.equal(liveCache.statusDetail({ players: null, phase: null, upConfirmed: false }), null);
});

test('statusDetail prefers a parsed player list over phase/up branches', () => {
  const detail = liveCache.statusDetail({
    players: { online: 3 },
    phase: { key: 'boot', label: 'Starting up' },
    upConfirmed: true,
  });
  assert.equal(detail, null);
});
