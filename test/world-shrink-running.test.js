'use strict';

// A shrink PREVIEW (dry run) only reads region files, so it must work while the
// server is up - the Worlds tab promises exactly that. A real shrink still
// refuses with 409.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const nbt = require('prismarine-nbt');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const config = require('../src/config');
const { SECTOR } = require('../src/utils/mcaRegion');

// Stub Docker BEFORE the service loads (it destructures inspectStatus at require time).
const containers = require('../src/docker/containers');
containers.inspectStatus = async () => ({ exists: true, status: 'running' });
const { shrinkWorld } = require('../src/services/worldShrink');

const SID = 'srv_shrink_live';

function region(chunks) {
  const header = Buffer.alloc(SECTOR * 2);
  const blocks = [];
  let sector = 2;
  for (const [index, ticks] of Object.entries(chunks)) {
    const body = nbt.writeUncompressed(nbt.comp({ InhabitedTime: { type: 'long', value: [0, ticks] } }));
    const comp = zlib.deflateSync(body);
    const head = Buffer.alloc(5);
    head.writeUInt32BE(comp.length + 1, 0);
    head.writeUInt8(2, 4);
    const raw = Buffer.concat([head, comp]);
    const sectors = Math.ceil(raw.length / SECTOR);
    const padded = Buffer.alloc(sectors * SECTOR);
    raw.copy(padded);
    header.writeUInt32BE(((sector << 8) | sectors) >>> 0, Number(index) * 4);
    blocks.push(padded);
    sector += sectors;
  }
  return Buffer.concat([header, ...blocks]);
}

test('a dry run works while the server is running; a real shrink is refused', async () => {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, 'Shrink Live', 'PAPER', 25681, 26681, 'x', 1024, 1536, 'running', '{}')`,
    SID
  );
  const regionDir = path.join(config.dataDir, 'servers', SID, 'world', 'region');
  fs.mkdirSync(regionDir, { recursive: true });
  const file = path.join(regionDir, 'r.0.0.mca');
  fs.writeFileSync(file, region({ 20: 1 }));
  const before = fs.readFileSync(file);

  const preview = await shrinkWorld(SID, { worldName: 'world', dryRun: true });
  assert.equal(preview.dryRun, true);
  assert.equal(preview.chunksRemoved, 1, 'the preview still estimates');
  assert.deepEqual(fs.readFileSync(file), before, 'nothing was written');

  await assert.rejects(
    () => shrinkWorld(SID, { worldName: 'world' }),
    (err) => err.status === 409 && /Stop the server/.test(err.message)
  );
  assert.deepEqual(fs.readFileSync(file), before, 'still nothing written');
});
