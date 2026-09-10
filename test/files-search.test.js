'use strict';

// "Find in files" (services/files.searchFiles): a bounded plain-substring grep
// scoped to a server's data dir. It must find matches, stay inside the scope,
// skip binaries, and report line/column.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const config = require('../src/config');
const files = require('../src/services/files');

const SID = 'srv_search';

function seed() {
  db.run(
    `INSERT OR IGNORE INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, 'Search Test', 'PAPER', 25670, 26670, 'x', 1024, 1536, 'stopped')`,
    SID
  );
  const root = path.join(config.dataDir, 'servers', SID);
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server.properties'), 'motd=Hello World\nlevel-name=world\npvp=true\n');
  fs.writeFileSync(path.join(root, 'config', 'mod.toml'), '[general]\ngreeting = "hello there"\nmaxPlayers = 20\n');
  fs.writeFileSync(path.join(root, 'world.bin'), Buffer.from([0x00, 0x01, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00]));
  return root;
}

test('searchFiles finds a case-insensitive substring with file, line and column', async () => {
  seed();
  const { matches } = await files.searchFiles(SID, 'hello');
  const paths = matches.map((m) => m.path).sort();
  assert.deepEqual(paths, ['config/mod.toml', 'server.properties']);

  const props = matches.find((m) => m.path === 'server.properties');
  assert.equal(props.line, 1);
  assert.equal(props.col, 'motd=Hello World'.indexOf('Hello') + 1);
  assert.match(props.text, /Hello World/);
});

test('searchFiles skips binary files (null-byte sniff)', async () => {
  seed();
  const { matches } = await files.searchFiles(SID, 'hello');
  assert.ok(!matches.some((m) => m.path === 'world.bin'), 'the binary file is not searched');
});

test('searchFiles honours case sensitivity', async () => {
  seed();
  const insensitive = await files.searchFiles(SID, 'HELLO');
  assert.ok(insensitive.matches.length >= 2);
  const sensitive = await files.searchFiles(SID, 'HELLO', { caseSensitive: true });
  assert.equal(sensitive.matches.length, 0);
});

test('searchFiles can be scoped to a subdirectory', async () => {
  seed();
  const { matches } = await files.searchFiles(SID, 'hello', { subdir: 'config' });
  assert.deepEqual(
    matches.map((m) => m.path),
    ['config/mod.toml']
  );
});

test('searchFiles rejects a too-short query', async () => {
  seed();
  await assert.rejects(() => files.searchFiles(SID, 'a'), /at least 2/);
});
