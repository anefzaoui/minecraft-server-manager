'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  db.run(
    `INSERT INTO servers (id, display_name, type, runtime, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, env_json)
     VALUES ('srv_bedrock_settings', 'Bedrock settings', 'BEDROCK', 'bedrock', 'LATEST', 19132, 0, '', 1024, 1536, ?)`,
    JSON.stringify({ SERVER_NAME: 'Old name', GAMEMODE: 'survival', MAX_PLAYERS: '10' })
  );
});

test.after(async () => {
  await app.stop();
});

test('Native Bedrock settings show supported properties and shared resources without Java controls', async () => {
  const page = await app.req('GET', '/servers/srv_bedrock_settings/settings', { cookie });
  assert.equal(page.status, 200);

  for (const key of [
    'SERVER_NAME',
    'GAMEMODE',
    'DIFFICULTY',
    'LEVEL_NAME',
    'MAX_PLAYERS',
    'ALLOW_CHEATS',
    'VIEW_DISTANCE',
  ]) {
    assert.match(page.text, new RegExp(`data-catalog-key="${key}"`), `${key} should be configurable`);
  }
  for (const id of ['st-heap', 'st-headroom']) assert.doesNotMatch(page.text, new RegExp(`id="${id}"`));
  for (const key of ['ENABLE_RCON', 'JVM_OPTS', 'MEMORY', 'JAVA_VERSION']) {
    assert.doesNotMatch(page.text, new RegExp(`data-catalog-key="${key}"`), `${key} must stay unavailable`);
  }
  assert.match(page.text, /id="st-cmem"/, 'shared container memory control remains available');
  assert.match(page.text, /id="st-cpu"/, 'shared CPU control remains available');
});

test('Native Bedrock property updates validate and require a container rebuild', async () => {
  const saved = await app.req('PATCH', '/api/servers/srv_bedrock_settings', {
    cookie,
    body: { env: { SERVER_NAME: 'New name', GAMEMODE: 'creative', MAX_PLAYERS: '24', VIEW_DISTANCE: '12' } },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.needsRecreate, true);
  assert.deepEqual(JSON.parse(db.get('SELECT env_json FROM servers WHERE id = ?', 'srv_bedrock_settings').env_json), {
    SERVER_NAME: 'New name',
    GAMEMODE: 'creative',
    MAX_PLAYERS: '24',
    VIEW_DISTANCE: '12',
  });

  const invalid = await app.req('PATCH', '/api/servers/srv_bedrock_settings', {
    cookie,
    body: { env: { SERVER_NAME: 'New name', GAMEMODE: 'not-a-mode' } },
  });
  assert.equal(invalid.status, 400);
});
