'use strict';

// Public world-service seam: saving a Native Bedrock world to the library must
// use the Bedrock save protocol and accept its LevelDB layout.
require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

migrate();

const worldsPath = require.resolve('../src/services/worlds');
const containersPath = require.resolve('../src/docker/containers');
const commandsPath = require.resolve('../src/services/consoleCommands');
const originalContainers = require.cache[containersPath];
const originalCommands = require.cache[commandsPath];
const commands = [];
let javaExecs = 0;

require.cache[containersPath] = {
  id: containersPath,
  filename: containersPath,
  loaded: true,
  exports: {
    inspectStatus: async () => ({ exists: true, status: 'running' }),
    execCapture: async () => {
      javaExecs += 1;
      throw new Error('Java RCON must not be used for Native Bedrock worlds.');
    },
  },
};
require.cache[commandsPath] = {
  id: commandsPath,
  filename: commandsPath,
  loaded: true,
  exports: {
    sendConsoleCommandParts: async (_server, _id, words) => {
      commands.push(words);
      return { source: 'bedrock-console', output: 'queued' };
    },
  },
};
delete require.cache[worldsPath];
const worlds = require(worldsPath);

test.after(() => {
  delete require.cache[worldsPath];
  if (originalContainers) require.cache[containersPath] = originalContainers;
  else delete require.cache[containersPath];
  if (originalCommands) require.cache[commandsPath] = originalCommands;
  else delete require.cache[commandsPath];
});

test('saving a running Native Bedrock world to the library uses save hold/resume and accepts LevelDB', async () => {
  const id = 'srv_bedrock_snapshot';
  db.run(
    `INSERT INTO servers (id, display_name, type, runtime, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, env_json)
     VALUES (?, 'Bedrock snapshot', 'BEDROCK', 'bedrock', 19132, 0, '', 1024, 1536, ?)`,
    id,
    JSON.stringify({ LEVEL_NAME: 'Bedrock level' })
  );
  const world = dataPath('servers', id, 'Bedrock level');
  fs.mkdirSync(path.join(world, 'db'), { recursive: true });
  fs.writeFileSync(path.join(world, 'levelname.txt'), 'Bedrock level');
  fs.writeFileSync(path.join(world, 'db', 'CURRENT'), 'MANIFEST-000001');

  try {
    const saved = await worlds.extractFromServer(id, { actor: 'test' });
    assert.equal(saved.world_flavor, 'BEDROCK');
    assert.deepEqual(commands, [
      ['save', 'hold'],
      ['save', 'resume'],
    ]);
    assert.equal(javaExecs, 0);
  } finally {
    db.run('DELETE FROM library_files WHERE world_source = ?', `extract:${id}`);
    db.run('DELETE FROM servers WHERE id = ?', id);
  }
});
