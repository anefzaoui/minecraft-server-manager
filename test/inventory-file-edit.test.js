'use strict';

// The offline (file-mode) inventory edit path: read the player's .dat, mutate,
// back up, gzip, atomic write. Pins the gzip step - `zlib.gzip` is callback-only
// and a bare `await zlib.gzip(buf)` throws ERR_INVALID_ARG_TYPE, which once made
// every stopped-server inventory edit fail after the backup had been taken.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const nbt = require('prismarine-nbt');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

// Stub Docker before the service loads: the server is stopped, so the edit
// must go through the file mechanism.
const containers = require('../src/docker/containers');
containers.inspectStatus = async () => ({ exists: true, status: 'stopped' });

const inventory = require('../src/services/inventory');

const SERVER = 'srv_invfile';
const UUID = '11111111-2222-3333-4444-555555555555';

function seed() {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher,
       heap_mb, container_memory_mb, status)
     VALUES (?, 'Inventory File Test', 'PAPER', 25598, 26598, 'x', 1024, 1536, 'stopped')`,
    SERVER
  );
  const dir = dataPath('servers', SERVER, 'world', 'playerdata');
  fs.mkdirSync(dir, { recursive: true });
  const root = {
    type: 'compound',
    name: '',
    value: {
      Inventory: {
        type: 'list',
        value: {
          type: 'compound',
          value: [
            {
              id: { type: 'string', value: 'minecraft:apple' },
              count: { type: 'int', value: 3 },
              Slot: { type: 'byte', value: 0 },
            },
          ],
        },
      },
      EnderItems: { type: 'list', value: { type: 'compound', value: [] } },
    },
  };
  fs.writeFileSync(`${dir}/${UUID}.dat`, zlib.gzipSync(nbt.writeUncompressed(root, 'big')));
  return `${dir}/${UUID}.dat`;
}

test('a stopped-server slot edit rewrites the gzip-compressed .dat and keeps a backup', async () => {
  const file = seed();
  await inventory.editSlot(SERVER, UUID, {
    container: 'inventory',
    slot: 1,
    op: 'set',
    item: 'minecraft:diamond',
    count: 5,
  });

  const buf = fs.readFileSync(file);
  assert.equal(buf[0], 0x1f, 'file is gzip-compressed');
  assert.equal(buf[1], 0x8b);
  const { parsed } = await nbt.parse(buf);
  const items = parsed.value.Inventory.value.value;
  const diamond = items.find((it) => it.id.value === 'minecraft:diamond');
  assert.ok(diamond, 'the new item was written');
  assert.equal(diamond.count.value, 5);
  assert.ok(
    items.some((it) => it.id.value === 'minecraft:apple'),
    'existing items survive'
  );

  const backups = fs
    .readdirSync(dataPath('servers', SERVER, 'world', 'playerdata'))
    .filter((n) => n.includes('.msm-bak'));
  assert.ok(backups.length >= 1, 'a backup of the previous .dat exists');
});
