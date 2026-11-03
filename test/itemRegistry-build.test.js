'use strict';

// Registry build/cache/search over real zip fixtures, plus the minecraft-data
// fallback with fetch stubbed.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const { buildZip } = require('./helpers/zipfix');
const reg = require('../src/services/itemRegistry');

const realFetchAll = global.fetch;
global.fetch = async () => {
  throw new Error('offline');
};
test.after(() => {
  global.fetch = realFetchAll;
});

let port = 26100;
function mkServer(id, mc = '1.21.1') {
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, ?, 'FABRIC', ?, ?, ?, 'x', 1024, 1536, 'stopped')`,
    id,
    id,
    mc,
    port,
    port + 1000
  );
  port++;
  fs.mkdirSync(dataPath('servers', id, 'mods'), { recursive: true });
  return id;
}
const lang = (o) => JSON.stringify(o);

test('builds from a plain vanilla jar plus fabric and forge mod jars', async () => {
  const id = mkServer('srv_ir1');
  const dir = dataPath('servers', id);
  await buildZip(path.join(dir, 'server.jar'), {
    'assets/minecraft/lang/en_us.json': lang({ 'item.minecraft.apple': 'Apple', 'block.minecraft.stone': 'Stone' }),
  });
  await buildZip(path.join(dir, 'mods', 'fab.jar'), {
    'fabric.mod.json': JSON.stringify({ id: 'fabmod', name: 'Fab Mod' }),
    'assets/fabmod/lang/en_us.json': lang({ 'item.fabmod.gem': 'Fab Gem', 'block.fabmod.ore': 'Fab Ore' }),
  });
  await buildZip(path.join(dir, 'mods', 'forge.jar'), {
    'META-INF/mods.toml': '[[mods]]\nmodId = "formod"\ndisplayName = "For Mod"\n',
    'assets/formod/lang/en_us.json': lang({ 'item.formod.rod': 'Zed Rod' }),
  });
  await buildZip(path.join(dir, 'mods', 'quilt.jar'), {
    'quilt.mod.json': JSON.stringify({ quilt_loader: { id: 'qmod', metadata: { name: 'Q Mod' } } }),
    'assets/qmod/lang/en_us.json': lang({ 'item.qmod.q': 'Q Item' }),
  });
  fs.writeFileSync(path.join(dir, 'mods', 'corrupt.jar'), 'not a zip');
  fs.writeFileSync(path.join(dir, 'mods', 'readme.txt'), 'ignored');

  const progress = [];
  const r = await reg.buildRegistry(id, { onProgress: (d, t) => progress.push([d, t]) });
  assert.equal(r.jarCount, 4);
  assert.equal(progress.length, 4);
  assert.equal(r.vanillaJar, 'server.jar');
  assert.deepEqual(r.mods.map((m) => m.name).sort(), ['Fab Mod', 'For Mod', 'Minecraft', 'Q Mod']);
  assert.equal(r.items.find((i) => i.id === 'fabmod:ore').kind, 'block');
  assert.equal(r.items.find((i) => i.id === 'formod:rod').mod, 'For Mod');

  // search: rank, filters, paging
  const all = await reg.search(id);
  assert.equal(all.total, 6);
  assert.equal((await reg.search(id, { q: 'stone' })).items[0].id, 'minecraft:stone');
  assert.equal((await reg.search(id, { q: 'apple' })).items[0].id, 'minecraft:apple');
  assert.equal((await reg.search(id, { q: 'fab' })).total, 2);
  assert.equal((await reg.search(id, { q: 'ore' })).items[0].id, 'fabmod:ore'); // name starts-with
  assert.equal((await reg.search(id, { q: 'abmod:g' })).items[0].id, 'fabmod:gem'); // id contains
  assert.equal((await reg.search(id, { mod: 'fabmod' })).total, 2);
  assert.equal((await reg.search(id, { kind: 'block' })).total, 2);
  assert.equal((await reg.search(id, { limit: 2, offset: 1 })).items.length, 2);
  assert.equal((await reg.getMods(id)).length, 4);
});

test('getRegistry serves from memory, then the db row, and rebuilds on change or force', async () => {
  const id = 'srv_ir1';
  const a = await reg.getRegistry(id);
  assert.equal(await reg.getRegistry(id), a, 'memory hit returns the same object');

  // Corrupt the persisted row: the in-memory copy still serves, force rebuilds.
  db.run("UPDATE api_cache SET value_json = 'garbage' WHERE key = ?", `item-registry:${id}`);
  const forced = await reg.getRegistry(id, { force: true });
  assert.notEqual(forced, a);

  await buildZip(dataPath('servers', id, 'mods', 'new.jar'), {
    'assets/newmod/lang/en_us.json': lang({ 'item.newmod.x': 'New X' }),
  });
  const changed = await reg.getRegistry(id);
  assert.ok(changed.items.some((i) => i.id === 'newmod:x'));
});

test('a registry row on disk with a matching fingerprint is reused', async () => {
  const id = mkServer('srv_ir2');
  const built = await reg.buildRegistry(id);
  const again = await reg.getRegistry(id);
  assert.equal(again.builtAt, built.builtAt);
  await assert.rejects(reg.buildRegistry('srv_missing'), { status: 404 });
});

test('a Mojang bundler jar has its nested server jar read', async () => {
  const id = mkServer('srv_ir3');
  const dir = dataPath('servers', id);
  const inner = path.join(dir, 'inner.jar');
  await buildZip(inner, { 'assets/minecraft/lang/en_us.json': lang({ 'item.minecraft.bread': 'Bread' }) });
  await buildZip(path.join(dir, 'server.jar'), {
    'META-INF/versions/1.21/server-1.21.jar': fs.readFileSync(inner),
  });
  fs.rmSync(inner);
  const r = await reg.buildRegistry(id);
  assert.ok(r.items.some((i) => i.id === 'minecraft:bread'));
});

test('without a server-jar lang file, vanilla items come from the minecraft-data fallback', async () => {
  const id = mkServer('srv_ir4', '1.21.1');
  db.run("DELETE FROM api_cache WHERE key LIKE 'mcdata:%'");
  const realFetch = global.fetch;
  const json = (body) => ({ ok: true, status: 200, json: async () => body });
  global.fetch = async (url) => {
    if (String(url).includes('api.github.com')) {
      return json([
        { type: 'dir', name: '1.20.4' },
        { type: 'dir', name: '1.21.1' },
        { type: 'dir', name: 'latest' },
        { type: 'file', name: '1.99' },
      ]);
    }
    if (String(url).endsWith('items.json'))
      return json([
        { name: 'stick', displayName: 'Stick' },
        { name: 'oak_log', displayName: 'Oak Log' },
        { name: 'bad' },
      ]);
    if (String(url).endsWith('blocks.json')) return json([{ name: 'oak_log' }]);
    throw new Error('unexpected ' + url);
  };
  try {
    const r = await reg.buildRegistry(id);
    assert.equal(r.items.find((i) => i.id === 'minecraft:oak_log').kind, 'block');
    assert.equal(r.items.find((i) => i.id === 'minecraft:stick').kind, 'item');
    assert.equal(r.items.length, 2);
    assert.equal(r.vanillaJar, null);

    // A network failure yields null rather than throwing.
    global.fetch = async () => {
      throw new Error('offline');
    };
    assert.equal((await reg.fetchVanillaFallback('1.21.1')).length, 2, 'stale cache beats nothing');
    db.run("DELETE FROM api_cache WHERE key LIKE 'mcdata:%'");
    assert.equal(await reg.fetchVanillaFallback('1.5.5'), null);
    assert.equal(await reg.fetchVanillaFallback(''), null);
  } finally {
    global.fetch = realFetch;
  }
});
