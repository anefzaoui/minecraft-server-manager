'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const config = require('../src/config');
const mods = require('../src/services/mods');
const modConfigs = require('../src/services/modConfigs');
const { jarBuffer } = require('./helpers/zipfix');

const SID = 'srv_mod_configs';
const configFile = 'config/example-mod.toml';
const lithiumConfig = 'config/lithium.properties';
let adminCookie;
let absoluteFile;
const originalListContent = mods.listContent;

test.before(async () => {
  await app.start();
  adminCookie = await app.adminCookie();
  app.seedServer(SID);
  absoluteFile = path.join(config.dataDir, 'servers', SID, configFile);
  fs.mkdirSync(path.dirname(absoluteFile), { recursive: true });
  fs.writeFileSync(absoluteFile, '[general]\nenabled = true\n');
  const jarPath = path.join(config.dataDir, 'servers', SID, 'mods', 'example-mod.jar');
  fs.mkdirSync(path.dirname(jarPath), { recursive: true });
  fs.writeFileSync(
    jarPath,
    await jarBuffer({ 'fabric.mod.json': JSON.stringify({ id: 'example_mod', name: 'Example Mod', version: '1.0' }) })
  );
  const lithiumJar = path.join(config.dataDir, 'servers', SID, 'mods', 'lithium.jar');
  fs.writeFileSync(
    lithiumJar,
    await jarBuffer({
      'fabric.mod.json': JSON.stringify({ id: 'lithium', name: 'Lithium', version: '0.15.4' }),
      'lithium-fabric-mixin-config.md':
        '# Lithium options\n### `mixin.ai.pathing`\n(default: false)\nImproves path-finding node checks and chunk access.\n\nRequirements:\n- `mixin.util.chunk_access=true`\n\n### `mixin.ai.poi`\n(default: true)\nImplements a faster POI search.\n',
    })
  );
  fs.writeFileSync(path.join(config.dataDir, 'servers', SID, lithiumConfig), 'mixin.ai.pathing=false\n');
  mods.listContent = async () => [
    { kind: 'mod', file: 'example-mod.jar', name: 'Example Mod', enabled: true, version: '1.0' },
    { kind: 'mod', file: 'lithium.jar', name: 'Lithium', enabled: true, version: '0.15.4' },
  ];
});

test.after(async () => {
  mods.listContent = originalListContent;
  await app.stop();
});

test('Configs groups confidently matched files by detected mod and separates unmatched files', async () => {
  const unmatchedPath = path.join(config.dataDir, 'servers', SID, 'config', 'common.toml');
  fs.writeFileSync(unmatchedPath, 'enabled = false\n');

  const listing = await modConfigs.list(SID);
  assert.equal(listing.groups.length, 2);
  const example = listing.groups.find((group) => group.name === 'Example Mod');
  assert.deepEqual(
    example.files.map((file) => file.path),
    [configFile]
  );
  const lithium = listing.groups.find((group) => group.name === 'Lithium');
  assert.deepEqual(
    lithium.files.map((file) => file.path),
    [lithiumConfig]
  );
  assert.match(lithium.descriptions['mixin.ai.pathing'], /path-finding node checks/);
  assert.deepEqual(
    listing.unassigned.map((file) => file.path),
    ['config/common.toml']
  );
});

test('the Configs tab shows mod groups and unassigned configs without a file explorer', async () => {
  const page = await app.req('GET', `/servers/${SID}/configs`, {
    cookie: adminCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(page.status, 200);
  assert.match(page.text, /Mod Configs/);
  assert.match(page.text, /Example Mod/);
  assert.match(page.text, /Unassigned Configs/);
  assert.match(page.text, /data-open-mod-config/);
  assert.match(page.text, /\/js\/pages\/configs\.js\?v=[a-z0-9]+/);
  assert.doesNotMatch(page.text, /Open File Manager|data-files-server/);

  const modsPage = await app.req('GET', `/servers/${SID}/mods`, {
    cookie: adminCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(modsPage.status, 200);
  assert.match(modsPage.text, new RegExp(`/servers/${SID}/configs`));
});

test('config API reads and writes only discovered text configs', async () => {
  const read = await app.req('GET', `/api/servers/${SID}/configs/file?path=${encodeURIComponent(configFile)}`, {
    cookie: adminCookie,
  });
  assert.equal(read.status, 200);
  assert.match(read.json.content, /enabled = true/);

  const described = await app.req('GET', `/api/servers/${SID}/configs/file?path=${encodeURIComponent(lithiumConfig)}`, {
    cookie: adminCookie,
  });
  assert.equal(described.status, 200);
  assert.match(described.json.descriptions['mixin.ai.pathing'], /path-finding node checks/);

  const write = await app.req('PUT', `/api/servers/${SID}/configs/file`, {
    cookie: adminCookie,
    body: { path: configFile, content: '[general]\nenabled = false\n' },
  });
  assert.equal(write.status, 200);
  assert.equal(fs.readFileSync(absoluteFile, 'utf8'), '[general]\nenabled = false\n');

  const largerContent = `# Large config preview\n${'x'.repeat(300_000)}\n`;
  const largerWrite = await app.req('PUT', `/api/servers/${SID}/configs/file`, {
    cookie: adminCookie,
    body: { path: configFile, content: largerContent },
  });
  assert.equal(largerWrite.status, 200);
  assert.equal(fs.readFileSync(absoluteFile, 'utf8'), largerContent);

  const rejected = await app.req('PUT', `/api/servers/${SID}/configs/file`, {
    cookie: adminCookie,
    body: { path: 'server.properties', content: 'motd=wrong scope' },
  });
  assert.equal(rejected.status, 404);
});
