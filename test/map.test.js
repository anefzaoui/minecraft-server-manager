'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const map = require('../src/services/map');

function mapsDirFor(id) {
  return dataPath('servers', id, 'plugins', 'BlueMap', 'maps'); // PAPER by default
}

/** activeLevelName() reads this - a world folder alone isn't enough to make it "active". */
function setLevelName(id, name) {
  fs.mkdirSync(dataPath('servers', id), { recursive: true });
  fs.writeFileSync(dataPath('servers', id, 'server.properties'), `level-name=${name}\n`);
}

test('writeMapConfigs points a fresh world.conf at a custom level-name, and skips missing dims', () => {
  const id = app.seedServer('srv_bmA');
  db.run("UPDATE servers SET type = 'PAPER' WHERE id = ?", id);
  setLevelName(id, 'myworld');
  fs.mkdirSync(dataPath('servers', id, 'myworld'), { recursive: true }); // the ACTUAL world folder

  map.writeMapConfigs(id);

  const dir = mapsDirFor(id);
  const overworld = fs.readFileSync(`${dir}/world.conf`, 'utf8');
  assert.match(overworld, /^world: "myworld"$/m);
  assert.match(overworld, /minecraft:overworld/);
  // Neither nether nor end folder exists - must not write bogus configs for them.
  assert.equal(fs.existsSync(`${dir}/world_nether.conf`), false);
  assert.equal(fs.existsSync(`${dir}/world_the_end.conf`), false);
});

test('writeMapConfigs surgically patches a stale world: line, preserving everything else BlueMap/the admin set', () => {
  const id = app.seedServer('srv_bmB');
  db.run("UPDATE servers SET type = 'PAPER' WHERE id = ?", id);
  setLevelName(id, 'survival');
  fs.mkdirSync(dataPath('servers', id, 'survival'), { recursive: true });

  // Simulate BlueMap's own (wrong) auto-generated config from before this fix
  // - pointed at the literal "world", plus custom settings an admin might add.
  const dir = mapsDirFor(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    `${dir}/world.conf`,
    'world: "world"\ndimension: "minecraft:overworld"\nname: "My Cool Map"\nsky-color: "#123456"\n'
  );

  map.writeMapConfigs(id);

  const text = fs.readFileSync(`${dir}/world.conf`, 'utf8');
  assert.match(text, /^world: "survival"$/m);
  // Untouched - a hand-customized name/color must survive the patch.
  assert.match(text, /name: "My Cool Map"/);
  assert.match(text, /sky-color: "#123456"/);
});

test('writeMapConfigs is a no-op rewrite once the world: line already matches', () => {
  const id = app.seedServer('srv_bmC');
  db.run("UPDATE servers SET type = 'PAPER' WHERE id = ?", id);
  fs.mkdirSync(dataPath('servers', id, 'world'), { recursive: true });

  map.writeMapConfigs(id);
  const dir = mapsDirFor(id);
  const before = fs.readFileSync(`${dir}/world.conf`, 'utf8');
  const beforeMtime = fs.statSync(`${dir}/world.conf`).mtimeMs;

  map.writeMapConfigs(id); // second call, same state
  const after = fs.readFileSync(`${dir}/world.conf`, 'utf8');
  assert.equal(after, before);
  // mtime is a weak signal on fast filesystems, so just assert content
  // equality above is the real guarantee; this is a soft extra check.
  assert.ok(fs.statSync(`${dir}/world.conf`).mtimeMs >= beforeMtime);
});

test('writeMapConfigs writes nether/end configs only when those dimension folders already exist', () => {
  const id = app.seedServer('srv_bmD');
  db.run("UPDATE servers SET type = 'PAPER' WHERE id = ?", id);
  fs.mkdirSync(dataPath('servers', id, 'world'), { recursive: true });
  fs.mkdirSync(dataPath('servers', id, 'world_nether'), { recursive: true });
  // world_the_end intentionally absent - nobody has visited the End yet.

  map.writeMapConfigs(id);

  const dir = mapsDirFor(id);
  assert.match(fs.readFileSync(`${dir}/world_nether.conf`, 'utf8'), /world: "world_nether"/);
  assert.match(fs.readFileSync(`${dir}/world_nether.conf`, 'utf8'), /minecraft:the_nether/);
  assert.equal(fs.existsSync(`${dir}/world_the_end.conf`), false);
});

test('a modded (non-Paper-family) server writes its maps config under config/bluemap, not plugins/BlueMap', () => {
  const id = app.seedServer('srv_bmE');
  db.run("UPDATE servers SET type = 'FABRIC' WHERE id = ?", id);
  fs.mkdirSync(dataPath('servers', id, 'world'), { recursive: true });

  map.writeMapConfigs(id);

  const dir = dataPath('servers', id, 'config', 'bluemap', 'maps');
  assert.equal(fs.existsSync(`${dir}/world.conf`), true);
});

test('switching the active world (worlds.activateWorld) refreshes BlueMap when it is enabled', async () => {
  const worlds = require('../src/services/worlds');
  const id = app.seedServer('srv_bmF');
  db.run("UPDATE servers SET type = 'PAPER' WHERE id = ?", id);
  setLevelName(id, 'world');
  fs.mkdirSync(dataPath('servers', id, 'world'), { recursive: true });
  fs.mkdirSync(dataPath('servers', id, 'creative'), { recursive: true });
  fs.writeFileSync(dataPath('servers', id, 'creative', 'level.dat'), ''); // activateWorld only checks existence

  db.run(
    "INSERT INTO integrations (server_id, kind, enabled, config_json) VALUES (?, 'bluemap', 1, ?)",
    id,
    JSON.stringify({ hostPort: 28300 })
  );
  map.writeMapConfigs(id); // simulate the map having been enabled while "world" was active

  await worlds.activateWorld(id, 'creative');

  const dir = mapsDirFor(id);
  assert.match(fs.readFileSync(`${dir}/world.conf`, 'utf8'), /^world: "creative"$/m);
});

test('switching the active world does NOT touch BlueMap configs when the map is not enabled', async () => {
  const worlds = require('../src/services/worlds');
  const id = app.seedServer('srv_bmG');
  db.run("UPDATE servers SET type = 'PAPER' WHERE id = ?", id);
  setLevelName(id, 'world');
  fs.mkdirSync(dataPath('servers', id, 'world'), { recursive: true });
  fs.mkdirSync(dataPath('servers', id, 'creative'), { recursive: true });
  fs.writeFileSync(dataPath('servers', id, 'creative', 'level.dat'), '');

  await worlds.activateWorld(id, 'creative'); // no integrations row at all - must not throw or create dirs

  assert.equal(fs.existsSync(mapsDirFor(id)), false);
});

test('writeMapConfigs strips quotes and newlines from the level name (no HOCON string break-out via LEVEL)', () => {
  const id = app.seedServer('srv_bmInj');
  db.run("UPDATE servers SET type = 'PAPER' WHERE id = ?", id);
  // A hostile LEVEL env value with the two chars that could break out of the
  // quoted `world: "<name>"` string and inject a config line.
  db.run('UPDATE servers SET env_json = ? WHERE id = ?', JSON.stringify({ LEVEL: 'my"\nevil world' }), id);
  fs.mkdirSync(dataPath('servers', id, 'myevil world'), { recursive: true });

  map.writeMapConfigs(id);

  const conf = fs.readFileSync(`${mapsDirFor(id)}/world.conf`, 'utf8');
  assert.match(conf, /^world: "myevil world"$/m, 'the " and newline are gone; the rest is kept verbatim');
  assert.equal(conf.split('\n').filter((l) => l.startsWith('world:')).length, 1, 'exactly one world: line');
});
