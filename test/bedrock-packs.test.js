'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const archiver = require('archiver');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { dataPath } = require('../src/storage/pathGuard');

let cookie;
const id = 'srv_bedrock_packs';

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  db.run(
    `INSERT INTO servers (id, display_name, type, runtime, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, env_json)
     VALUES (?, 'Bedrock packs', 'BEDROCK', 'bedrock', 'LATEST', 19132, 0, '', 1024, 1536, '{}')`,
    id
  );
});

test.after(async () => app.stop());

test('Native Bedrock exposes a dedicated Packs experience instead of Java installation controls', async () => {
  const page = await app.req('GET', `/servers/${id}/mods`, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(page.status, 200);
  assert.match(page.text, /Bedrock Packs/);
  assert.match(page.text, /Behavior Packs/);
  assert.match(page.text, /Resource Packs/);
  assert.match(page.text, /data-bedrock-pack-upload/);
  assert.doesNotMatch(page.text, /Search Mods|Import Modrinth Modpack|Add by URL/);
});

test('Bedrock pack API rejects Java runtimes', async () => {
  const javaId = app.seedServer('srv_java_no_bedrock_packs');
  const packs = await app.req('GET', `/api/servers/${javaId}/bedrock-packs`, { cookie });
  assert.equal(packs.status, 400);
});

test('a valid behavior pack uploads, lists, and removes through the Bedrock pack API', async () => {
  const archivePath = dataPath('tmp', 'bedrock-pack-test.mcpack');
  await makePack(archivePath, {
    header: { name: 'Test behavior pack', uuid: 'a1b2c3d4-e5f6-4789-aaaa-bbbbbbbbbbbb', version: [1, 0, 0] },
    modules: [{ type: 'data', uuid: 'c1b2c3d4-e5f6-4789-aaaa-bbbbbbbbbbbb', version: [1, 0, 0] }],
  });
  const form = new FormData();
  form.set('kind', 'behavior');
  form.set('file', new Blob([await fsp.readFile(archivePath)]), 'test.mcpack');
  const uploaded = await app.req('POST', `/api/servers/${id}/bedrock-packs`, { cookie, form });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.json.pack.kind, 'behavior');
  assert.equal(uploaded.json.pack.name, 'Test behavior pack');

  const listed = await app.req('GET', `/api/servers/${id}/bedrock-packs`, { cookie });
  assert.equal(listed.status, 200);
  assert.ok(listed.json.packs.some((pack) => pack.id === uploaded.json.pack.id));

  const removed = await app.req('DELETE', `/api/servers/${id}/bedrock-packs/behavior/${uploaded.json.pack.id}`, { cookie });
  assert.equal(removed.status, 200);
  await fsp.rm(archivePath, { force: true });
});

function makePack(file, manifest) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(file);
    const zip = archiver('zip');
    output.on('close', resolve);
    output.on('error', reject);
    zip.on('error', reject);
    zip.pipe(output);
    zip.append(JSON.stringify(manifest), { name: 'manifest.json' });
    zip.finalize();
  });
}
