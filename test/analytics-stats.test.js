'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { dataPath } = require('../src/storage/pathGuard');
const db = require('../src/db');
const stats = require('../src/analytics/stats');
const app = require('./helpers/app');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

const UUID = '3f5f7c2a-8a4e-4a1a-9c1b-000000000001';
const USERCACHE = [{ name: 'Steve', uuid: UUID }];

function seedWorld(serverId, files = {}) {
  fs.mkdirSync(dataPath('servers', serverId, 'world', 'players', 'stats'), { recursive: true });
  fs.mkdirSync(dataPath('servers', serverId), { recursive: true });
  fs.writeFileSync(dataPath('servers', serverId, 'usercache.json'), JSON.stringify(USERCACHE, null, 2) + '\n');
  for (const [name, data] of Object.entries(files)) {
    const p = dataPath('servers', serverId, 'world', 'players', 'stats', `${name}.json`);
    if (data === null) fs.rmSync(p, { force: true });
    else fs.mkdirSync(dataPath('servers', serverId, 'world', 'players', 'stats'), { recursive: true });
    if (data !== null) fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  }
}

const SAMPLE_STATS = {
  stats: {
    'minecraft:custom': {
      'minecraft:play_time': 6000,
      'minecraft:deaths': 2,
      'minecraft:mob_kills': 5,
      'minecraft:player_kills': 1,
      'minecraft:walk_one_cm': 1600,
      'minecraft:jump': 10,
      'minecraft:damage_dealt': 50,
    },
    'minecraft:mined': {
      'minecraft:stone': 64,
      'minecraft:diamond_ore': 16,
      'minecraft:iron_ore': 8,
    },
    'minecraft:used': { 'minecraft:stone': 10 },
  },
};

test('curate flattens vanilla stats into the curated shape', () => {
  const c = stats.curate(SAMPLE_STATS);
  assert.equal(c.playtimeTicks, 6000);
  assert.equal(c.deaths, 2);
  assert.equal(c.mobKills, 5);
  assert.equal(c.playerKills, 1);
  assert.equal(c.distanceCm, 1600); // walk_one_cm summed
  assert.equal(c.diamondsMined, 16);
  assert.equal(c.ironMined, 8);
  assert.equal(c.stoneMined, 64);
  assert.equal(c.blocksMinedTotal, 88);
  assert.equal(c.blocksUsedTotal, 10);
});

test('curate tolerates missing/empty sections and non-numeric values', () => {
  const c = stats.curate({});
  assert.equal(c.playtimeTicks, 0);
  assert.equal(c.distanceCm, 0);
  assert.equal(c.deaths, 0);

  const weird = stats.curate({
    stats: {
      'minecraft:custom': { 'minecraft:deaths': 'not-a-number', 'minecraft:play_time': 100 },
      'minecraft:mined': { 'minecraft:stone': 'oops' },
    },
  });
  assert.equal(weird.deaths, 0);
  assert.equal(weird.playtimeTicks, 100);
  assert.equal(weird.stoneMined, 0);
});

test('curate falls back to play_one_minute for older versions', () => {
  const c = stats.curate({
    stats: { 'minecraft:custom': { 'minecraft:play_one_minute': 7000 } },
  });
  assert.equal(c.playtimeTicks, 7000);
});

test('ingestStats snapshots new/changed stats and skips unchanged ones', async () => {
  const id = app.seedServer('st_ingest');
  seedWorld(id, { [UUID]: SAMPLE_STATS });
  const first = await stats.ingestStats(id);
  assert.equal(first.players, 1);
  assert.equal(first.snapshots, 1);

  const p = stats.profile(id, UUID);
  assert.equal(p.name, 'Steve');
  assert.equal(p.playtimeSeconds, 300); // 6000 ticks / 20
  assert.equal(p.stats.deaths, 2);

  // Unchanged stats => no new snapshot
  const second = await stats.ingestStats(id);
  assert.equal(second.snapshots, 0);
  const count = db.get('SELECT COUNT(*) n FROM player_stat_snapshots WHERE server_id = ?', id).n;
  assert.equal(count, 1);
});

test('ingestStats returns zeros for a server with no stats directory', async () => {
  const id = app.seedServer('st_none');
  const res = await stats.ingestStats(id);
  assert.deepEqual(res, { players: 0, snapshots: 0 });
});

test('ingestStats throws 404 for an unknown server', async () => {
  await assert.rejects(
    () => stats.ingestStats('does-not-exist'),
    (err) => err.status === 404
  );
});

test('profile returns null for a player with no snapshot', () => {
  const id = app.seedServer('st_prof_null');
  assert.equal(stats.profile(id, UUID), null);
});

test('profile computes 24h/7d deltas from baseline snapshots', async () => {
  const id = app.seedServer('st_delta');
  // Two snapshots: an old baseline and the current one.
  db.run(
    'INSERT INTO player_stat_snapshots (server_id, uuid, name, ts, stats_json) VALUES (?, ?, ?, ?, ?)',
    id,
    UUID,
    'Steve',
    new Date(Date.now() - 30 * 86_400_000).toISOString(),
    JSON.stringify(stats.curate(SAMPLE_STATS))
  );
  const newerStats = { ...SAMPLE_STATS };
  newerStats.stats['minecraft:custom']['minecraft:deaths'] = 4;
  db.run(
    'INSERT INTO player_stat_snapshots (server_id, uuid, name, ts, stats_json) VALUES (?, ?, ?, ?, ?)',
    id,
    UUID,
    'Steve',
    new Date().toISOString(),
    JSON.stringify(stats.curate(newerStats))
  );
  const p = stats.profile(id, UUID);
  assert.equal(p.deltas['24h'].deaths, 2); // 4 - 2 baseline
  assert.equal(p.deltas['7d'].deaths, 2);
  assert.ok(p.playstyle.miner > 0);
});

test('scoreboard ranks players and throws on an unknown metric', async () => {
  const id = app.seedServer('st_board');
  db.run(
    'INSERT INTO player_stat_snapshots (server_id, uuid, name, ts, stats_json) VALUES (?, ?, ?, ?, ?)',
    id,
    UUID,
    'Steve',
    new Date().toISOString(),
    JSON.stringify(stats.curate(SAMPLE_STATS))
  );
  const board = stats.scoreboard(id, { metric: 'deaths' });
  assert.equal(board.length, 1);
  assert.equal(board[0].rank, 1);
  assert.equal(board[0].crown, true);
  assert.throws(() => stats.scoreboard(id, { metric: 'nope' }), /Unknown metric/);
});

test('xrayReport flags high ratios and reports medians', async () => {
  const id = app.seedServer('st_xray');
  // Two low-ratio players (lots of stone, no diamonds) keep the median at ~0.
  for (const [uuid, name] of [
    ['11111111-2222-3333-4444-555555555555', 'Alex'],
    ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'Morgan'],
  ]) {
    db.run(
      'INSERT INTO player_stat_snapshots (server_id, uuid, name, ts, stats_json) VALUES (?, ?, ?, ?, ?)',
      id,
      uuid,
      name,
      new Date().toISOString(),
      JSON.stringify(stats.curate({ stats: { 'minecraft:custom': {}, 'minecraft:mined': { 'minecraft:stone': 400 } } }))
    );
  }
  // Steve: 64 stone + 16 diamonds => extreme ratio vs a ~0 median
  db.run(
    'INSERT INTO player_stat_snapshots (server_id, uuid, name, ts, stats_json) VALUES (?, ?, ?, ?, ?)',
    id,
    UUID,
    'Steve',
    new Date().toISOString(),
    JSON.stringify(stats.curate(SAMPLE_STATS))
  );
  const report = stats.xrayReport(id);
  assert.equal(report.sampleSize, 3);
  assert.equal(report.players.length, 3);
  const steve = report.players.find((p) => p.name === 'Steve');
  assert.equal(steve.flagged, true);
  assert.match(steve.reasons[0], /diamond ratio/);
  assert.equal(report.flagged.length, 1);
});
