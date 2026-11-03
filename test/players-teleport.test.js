'use strict';

// Teleport / kick / ban-sweep paths of the players service with RCON scripted.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

const containers = require('../src/docker/containers');
const calls = [];
let script = () => '';
containers.execCapture = async (id, argv) => {
  const cmd = argv.filter((a) => a !== 'rcon-cli' && a !== '--').join(' ');
  calls.push(cmd);
  return script(cmd);
};
let dockerStatus = { exists: true, status: 'running' };
containers.inspectStatus = async () => dockerStatus;

const players = require('../src/services/players');

const SID = 'srv_tp';
const R = { running: true, actor: 'tester' };

test.before(() => {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, 'TP', 'PAPER', 25950, 26950, 'x', 1024, 1536, 'running')`,
    SID
  );
  fs.mkdirSync(dataPath('servers', SID), { recursive: true });
});
test.beforeEach(() => {
  calls.length = 0;
  script = () => '';
});

test('every teleport requires a running server and a valid name', async () => {
  await assert.rejects(players.tpToPlayer(SID, 'Steve', 'Alex'), { status: 409 });
  await assert.rejects(players.kickPlayer(SID, 'Steve', 'x'), { status: 409 });
  await assert.rejects(players.tpToCoords(SID, 'bad name!', { x: 1, z: 2 }, R), { status: 400 });
  await assert.rejects(players.rtpPlayer(SID, 'Steve', {}, { running: false }), { status: 409 });
});

test('kickPlayer: success and not-online', async () => {
  script = () => 'Kicked Steve: bye';
  assert.deepEqual(await players.kickPlayer(SID, 'Steve', 'bye', R), { name: 'Steve', kicked: true });
  script = () => 'No player was found';
  await assert.rejects(players.kickPlayer(SID, 'Steve', '', R), { status: 404 });
});

test('tpToPlayer maps rcon failures to statuses', async () => {
  script = () => 'Teleported Steve to Alex';
  assert.equal((await players.tpToPlayer(SID, 'Steve', 'Alex', R)).target, 'Alex');
  script = () => 'No entity was found';
  await assert.rejects(players.tpToPlayer(SID, 'Steve', 'Alex', R), { status: 404 });
  script = () => 'Unknown or incomplete command';
  await assert.rejects(players.tpToPlayer(SID, 'Steve', 'Alex', R), { status: 400 });
});

test('tpToCoords: explicit Y (soft landing, dimension) and surface snap', async () => {
  script = () => 'Teleported';
  const r = await players.tpToCoords(SID, 'Steve', { x: 1, y: 70, z: 3, dimension: 'minecraft:the_end' }, R);
  assert.equal(r.y, 70);
  assert.ok(calls.some((c) => c.startsWith('effect give Steve minecraft:slow_falling')));
  assert.ok(calls.some((c) => c.startsWith('execute in minecraft:the_end run tp Steve 1 70 3')));

  calls.length = 0;
  await players.tpToCoords(SID, 'Steve', { x: 1, y: 70, z: 3, safe: false }, R);
  assert.ok(!calls.some((c) => c.startsWith('effect')));
  assert.ok(calls.includes('tp Steve 1 70 3'));

  script = () => 'Spread 1 player';
  const s = await players.tpToCoords(SID, 'Steve', { x: 5, z: 6 }, R);
  assert.equal(s.y, 'surface');

  await assert.rejects(players.tpToCoords(SID, 'Steve', { x: 'a', z: 2 }, R), { status: 400 });
  await assert.rejects(players.tpToCoords(SID, 'Steve', { x: 1, z: 2, dimension: 'minecraft:mars' }, R), {
    status: 400,
  });
});

test('surface teleport widens the search, then gives up with 409', async () => {
  script = () => 'Could not spread 1 player';
  await assert.rejects(players.tpToCoords(SID, 'Steve', { x: 5, z: 6, dimension: 'minecraft:the_nether' }, R), {
    status: 409,
  });
  assert.equal(calls.length, 3);
  assert.ok(calls[0].includes('under 120'));
  script = () => 'No player was found';
  await assert.rejects(players.tpToCoords(SID, 'Steve', { x: 5, z: 6 }, R), { status: 404 });
});

test('rtpPlayer lands, retries no-ground picks, and stops when the player left', async () => {
  let n = 0;
  script = () => (++n <= 3 ? 'Could not spread' : 'Spread 1 player');
  const ok = await players.rtpPlayer(SID, 'Steve', { minDistance: 10, maxDistance: 100, center: 'origin' }, R);
  assert.equal(ok.attempts, 2);
  script = () => 'Could not spread';
  await assert.rejects(players.rtpPlayer(SID, 'Steve', {}, R), { status: 409 });
  script = () => 'No player was found';
  await assert.rejects(players.rtpPlayer(SID, 'Steve', {}, R), { status: 404 });
});

test('tpToStructure: locate, teleport, and failure modes', async () => {
  script = (c) =>
    c.includes('locate') ? 'The nearest minecraft:village is at [100, ~, -200] (5 blocks away)' : 'Spread';
  const r = await players.tpToStructure(SID, 'Steve', 'minecraft:village_plains', {}, R);
  assert.deepEqual([r.x, r.z, r.dimension], [100, -200, 'minecraft:overworld']);

  const rnd = await players.tpToStructure(SID, 'Steve', 'minecraft:fortress', { random: true }, R);
  assert.equal(rnd.dimension, 'minecraft:the_nether');

  await assert.rejects(players.tpToStructure(SID, 'Steve', 'BAD ID', {}, R), { status: 400 });
  script = () => 'Could not find a structure';
  await assert.rejects(players.tpToStructure(SID, 'Steve', 'minecraft:village_plains', { random: true }, R), {
    status: 404,
  });
  script = () => 'garbage';
  await assert.rejects(players.tpToStructure(SID, 'Steve', 'minecraft:igloo', {}, R), { status: 502 });
  script = () => "There is no structure with type 'x'";
  await assert.rejects(players.tpToStructure(SID, 'Steve', 'minecraft:igloo', {}, R), { status: 404 });
});

test('tpToBiome: dimension-aware locate and failures', async () => {
  script = (c) => {
    if (c.includes('tags worldgen/biome')) return 'nothing';
    return c.includes('locate') ? 'The nearest minecraft:desert is at [10, ~, 20] (1 blocks away)' : 'Spread';
  };
  const r = await players.tpToBiome(SID, 'Steve', 'minecraft:desert', R);
  assert.deepEqual([r.x, r.z, r.dimension], [10, 20, 'minecraft:overworld']);
  const nether = await players.tpToBiome(SID, 'Steve', 'minecraft:crimson_forest', R);
  assert.equal(nether.dimension, 'minecraft:the_nether');

  await assert.rejects(players.tpToBiome(SID, 'Steve', 'nope', R), { status: 400 });
  script = (c) => (c.includes('locate') ? 'Could not find biome' : 'x');
  await assert.rejects(players.tpToBiome(SID, 'Steve', 'minecraft:desert', R), { status: 404 });
  script = (c) => (c.includes('locate') ? '' : 'x');
  await assert.rejects(players.tpToBiome(SID, 'Steve', 'minecraft:desert', R), { status: 502 });
});

test('server registries: modded tag scans are filtered, paged, and cached', async () => {
  script = (c) => {
    if (c.startsWith('neoforge tags worldgen/structure list'))
      return '<page 1 / 1>\n - modx:castle\n - modx:castle_blacklist\n';
    if (c.startsWith('neoforge tags worldgen/biome get')) {
      const tag = c.includes('is_nether') ? 'nether' : c.includes('is_end') ? 'end' : 'over';
      return Array.from({ length: 5 }, (_, i) => ` - mod:${tag}_${i}`).join('\n');
    }
    return 'unknown';
  };
  const st = await players.getServerStructures('srv_tp_reg', { running: true });
  assert.ok(st.some((s) => s.id === '#modx:castle'));
  assert.ok(!st.some((s) => s.id.includes('blacklist')));
  const before = calls.length;
  await players.getServerStructures('srv_tp_reg', { running: true });
  assert.equal(calls.length, before, 'second call is served from cache');

  const bi = await players.getServerBiomes('srv_tp_reg', { running: true });
  assert.equal(bi.byId.get('mod:end_0')[0], 'minecraft:the_end');
  const vanilla = await players.getServerBiomes('srv_tp_reg2', { running: false });
  assert.ok(vanilla.biomes.length > 10);
});

test('getPlayerPosition reads the marker position and dimension', async () => {
  script = (c) => {
    if (c.includes('summon')) return 'Summoned new Marker';
    if (c.includes('data get entity')) return 'Marker has the following entity data: [1.5d, 64.0d, -3.2d]';
    if (c.includes('in minecraft:the_nether')) return 'Killed Marker';
    return 'No entity was found';
  };
  assert.deepEqual(await players.getPlayerPosition(SID, 'Steve'), {
    x: 2,
    y: 64,
    z: -3,
    dimension: 'minecraft:the_nether',
  });
  script = () => '';
  await assert.rejects(players.getPlayerPosition(SID, 'Steve'), { status: 404 });
  script = (c) => (c.includes('summon') ? 'Summoned' : 'garbled');
  await assert.rejects(players.getPlayerPosition(SID, 'Steve'), { status: 502 });
});

// A real-shaped UUID: the service ignores anything else read from a server's own
// files and falls back to the Mojang API, which would make this test depend on
// the network (and fail whenever Mojang is unreachable or rate limits the runner).
const GRIEFER_UUID = '3f5f7c2a-8a4e-4a1a-9c1b-000000000001';

test('sweepExpiredBans pardons expired player and IP bans', async () => {
  const dir = dataPath('servers', SID);
  const past = new Date(Date.now() - 86_400_000).toISOString().slice(0, 19).replace('T', ' ') + ' +0000';
  fs.writeFileSync(
    `${dir}/banned-players.json`,
    JSON.stringify([{ uuid: GRIEFER_UUID, name: 'Griefer', created: past, source: 's', expires: past, reason: 'r' }])
  );
  fs.writeFileSync(
    `${dir}/banned-ips.json`,
    JSON.stringify([{ ip: '1.2.3.4', created: past, source: 's', expires: past, reason: 'r' }])
  );
  dockerStatus = { exists: false };
  await players.sweepExpiredBans();
  assert.deepEqual(JSON.parse(fs.readFileSync(`${dir}/banned-players.json`, 'utf8')), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${dir}/banned-ips.json`, 'utf8')), []);
  dockerStatus = { exists: true, status: 'running' };
});
