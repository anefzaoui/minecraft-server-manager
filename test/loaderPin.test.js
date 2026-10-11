'use strict';

// Changing the mod loader version of an existing server (Versions tab): what
// the card reports for each kind of server, the route's refusals (permission,
// a build that does not exist, a registry it cannot reach, a modpack with no
// override), the apply flow (backup → pin → rebuild → history), and the
// update checker never offering a step back from a newer pinned build.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = require('./helpers/app');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

const MAVEN_URL = 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml';
const PROMOS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const FABRIC_URL = 'https://meta.fabricmc.net/v2/versions/loader';
const MOJANG_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';

const FORGE_1201 = ['47.4.26', '47.4.25', '47.4.15', '47.4.10', '47.3.0'];
const mavenXml = () =>
  `<metadata><versioning><versions>${FORGE_1201.map((v) => `<version>1.20.1-${v}</version>`).join('')}</versions></versioning></metadata>`;

let cookie;
let viewerCookie;
let port = 27500;

const realFetch = globalThis.fetch;
let routes;
function stubRegistries() {
  routes = {
    [MAVEN_URL]: () => new Response(mavenXml(), { status: 200 }),
    [PROMOS_URL]: () => Response.json({ promos: { '1.20.1-recommended': '47.4.10', '1.20.1-latest': '47.4.26' } }),
    [FABRIC_URL]: () =>
      Response.json([
        { version: '0.17.2', stable: true },
        { version: '0.16.14', stable: true },
      ]),
    [MOJANG_URL]: () => Response.json({ latest: { release: '1.20.1', snapshot: '1.20.1' }, versions: [] }),
  };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1')) return realFetch(input, init);
    const route = routes[url];
    return route ? route() : new Response('not found', { status: 404 });
  };
}

function seed(id, { type = 'FORGE', mc = '1.20.1', env = {}, manifest = null } = {}) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, ?, ?, ?, ?, 'x', 1024, 1536, 'stopped', 'notify', ?)`,
    id,
    id,
    type,
    mc,
    port,
    port + 1,
    JSON.stringify(env)
  );
  fs.mkdirSync(dataPath('servers', id), { recursive: true });
  if (manifest) {
    fs.writeFileSync(dataPath('servers', id, `.${manifest.loader}-manifest.json`), JSON.stringify(manifest.body));
  }
  return id;
}

const envOf = (id) => JSON.parse(db.get('SELECT env_json FROM servers WHERE id = ?', id).env_json);

// Backups and rebuilds need Docker; the flow around them is what is tested.
// loaderPin calls them through the module objects, so patching the exports
// reaches it.
const backups = require('../src/services/backups');
const servers = require('../src/services/servers');
const containers = require('../src/docker/containers');
const realCreateBackup = backups.createBackup;
const realRecreate = servers.recreateServer;
const realInspect = containers.inspectStatus;
let calls;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  const authService = require('../src/services/auth');
  await authService.createUser(
    { username: 'lp_viewer', password: 'passw0rd-12345', role: 'viewer' },
    { actor: 'test' }
  );
  const r = await app.req('POST', '/login', { body: { username: 'lp_viewer', password: 'passw0rd-12345' } });
  viewerCookie = (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
});

test.after(async () => {
  backups.createBackup = realCreateBackup;
  servers.recreateServer = realRecreate;
  containers.inspectStatus = realInspect;
  globalThis.fetch = realFetch;
  await app.stop();
});

test.beforeEach(() => {
  db.run("DELETE FROM api_cache WHERE key LIKE 'loader:%'");
  stubRegistries();
  calls = [];
  backups.createBackup = async (serverId, opts) => {
    calls.push(['backup', serverId, opts.reason, opts.note]);
    return { id: 'bkp_test' };
  };
  servers.recreateServer = async (serverId) => {
    // The pin must already be stored when the rebuild reads it.
    calls.push(['rebuild', serverId, envOf(serverId)]);
  };
  containers.inspectStatus = async () => {
    throw new Error('no Docker in unit tests');
  };
});

async function settle(taskId) {
  const tasks = require('../src/services/tasks');
  for (let i = 0; i < 200; i++) {
    const t = tasks.getTask(taskId);
    if (t && t.state !== 'running') return t;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('task did not finish');
}

// ---- What the card reports -------------------------------------------------

test('a plain Forge server: the pin, and the installed build from the image manifest', () => {
  const { loaderVersionInfo } = require('../src/services/loaderPin');
  const id = seed('srv_lp_info_forge', {
    env: { FORGE_VERSION: '47.4.10' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  const info = loaderVersionInfo(servers.getServer(id));
  assert.deepEqual(info, {
    loader: 'forge',
    loaderName: 'Forge',
    source: 'server',
    envKey: 'FORGE_VERSION',
    pinned: '47.4.10',
    installed: '47.4.10',
    mcVersion: '1.20.1',
    editable: true,
  });
});

test('an unpinned server before its first start has no installed build yet', () => {
  const { loaderVersionInfo } = require('../src/services/loaderPin');
  const id = seed('srv_lp_info_fresh', { type: 'NEOFORGE', mc: '1.21.1' });
  const info = loaderVersionInfo(servers.getServer(id));
  assert.equal(info.envKey, 'NEOFORGE_VERSION');
  assert.equal(info.pinned, '');
  assert.equal(info.installed, null);
  assert.equal(info.mcVersion, '1.21.1');
});

test('Fabric and Quilt installed builds come from their own manifest fields', () => {
  const { loaderVersionInfo } = require('../src/services/loaderPin');
  const fabric = seed('srv_lp_info_fabric', {
    type: 'FABRIC',
    manifest: { loader: 'fabric', body: { origin: { '@type': 'versions', game: '1.20.1', loader: '0.16.14' } } },
  });
  assert.equal(loaderVersionInfo(servers.getServer(fabric)).installed, '0.16.14');
  const quilt = seed('srv_lp_info_quilt', {
    type: 'QUILT',
    manifest: { loader: 'quilt', body: { minecraftVersion: '1.20.1', loaderVersion: '0.26.4' } },
  });
  const info = loaderVersionInfo(servers.getServer(quilt));
  assert.equal(info.installed, '0.26.4');
  assert.equal(info.envKey, 'QUILT_LOADER_VERSION');
});

test('a CurseForge pack is overridden through CF_MOD_LOADER_VERSION', () => {
  const { loaderVersionInfo } = require('../src/services/loaderPin');
  const id = seed('srv_lp_info_cf', {
    type: 'AUTO_CURSEFORGE',
    env: { CF_SLUG: 'somepack', CF_FILE_ID: '123' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  const info = loaderVersionInfo(servers.getServer(id));
  assert.equal(info.source, 'curseforge');
  assert.equal(info.envKey, 'CF_MOD_LOADER_VERSION');
  assert.equal(info.pinned, '');
  assert.equal(info.installed, '47.4.10');
  assert.equal(info.editable, true);
});

test('a Modrinth pack shows its loader but cannot be overridden', () => {
  const { loaderVersionInfo } = require('../src/services/loaderPin');
  const id = seed('srv_lp_info_mr', {
    type: 'MODRINTH',
    env: { MODRINTH_MODPACK: 'somepack', MODRINTH_VERSION: 'abc' },
    manifest: { loader: 'fabric', body: { origin: { '@type': 'versions', loader: '0.16.14' } } },
  });
  const info = loaderVersionInfo(servers.getServer(id));
  assert.equal(info.source, 'modpack');
  assert.equal(info.envKey, null);
  assert.equal(info.editable, false);
  assert.equal(info.installed, '0.16.14');
});

test('servers without a mod loader have no card', () => {
  const { loaderVersionInfo } = require('../src/services/loaderPin');
  assert.equal(loaderVersionInfo(servers.getServer(seed('srv_lp_info_paper', { type: 'PAPER' }))), null);
  assert.equal(loaderVersionInfo(servers.getServer(seed('srv_lp_info_vanilla', { type: 'VANILLA' }))), null);
  // A CurseForge pack that has never been installed: the loader isn't known yet.
  const cf = seed('srv_lp_info_cf_new', { type: 'AUTO_CURSEFORGE', env: { CF_SLUG: 'x', CF_FILE_ID: '1' } });
  assert.equal(loaderVersionInfo(servers.getServer(cf)), null);
});

test('a corrupt manifest reads as "not installed", it does not break the page', () => {
  const { loaderVersionInfo } = require('../src/services/loaderPin');
  const id = seed('srv_lp_info_corrupt');
  fs.writeFileSync(dataPath('servers', id, '.forge-manifest.json'), '{not json');
  assert.equal(loaderVersionInfo(servers.getServer(id)).installed, null);
});

// ---- The route's refusals --------------------------------------------------

test('a viewer cannot change the loader version', async () => {
  const id = seed('srv_lp_viewer');
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, {
    cookie: viewerCookie,
    body: { version: '47.4.15' },
  });
  assert.equal(r.status, 403);
  assert.deepEqual(envOf(id), {});
});

test('a malformed version is refused before anything else', async () => {
  const id = seed('srv_lp_bad');
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15; rm' } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /not a valid loader version/);
});

test('a build that does not exist for this Minecraft version is refused, and nothing changes', async () => {
  const id = seed('srv_lp_unknown');
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.99' } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "Forge 47.4.99 isn't a published build for Minecraft 1.20.1.");
  assert.deepEqual(calls, []);
  assert.deepEqual(envOf(id), {});
});

test('an unreachable build list is a friendly, retryable refusal', async () => {
  const id = seed('srv_lp_offline');
  routes[MAVEN_URL] = () => new Response('down', { status: 503 });
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15' } });
  assert.equal(r.status, 424);
  assert.match(r.json.error, /Couldn't reach the Forge build list/);
  assert.deepEqual(calls, []);
});

test('a Modrinth pack is told to update the pack instead', async () => {
  const id = seed('srv_lp_mr', {
    type: 'MODRINTH',
    env: { MODRINTH_MODPACK: 'p', MODRINTH_VERSION: 'v' },
    manifest: { loader: 'forge', body: { forgeVersion: '47.4.10' } },
  });
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15' } });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /Update the modpack/);
});

test('a server without a mod loader is refused', async () => {
  const id = seed('srv_lp_paper', { type: 'PAPER' });
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15' } });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /no mod loader/);
});

test('choosing the version already set is a no-op refusal', async () => {
  const id = seed('srv_lp_same', { env: { FORGE_VERSION: '47.4.15' } });
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15' } });
  assert.equal(r.status, 409);
  assert.deepEqual(calls, []);
});

// ---- Applying ---------------------------------------------------------------

test('a plain Forge server: backup, then the pin, then the rebuild, then history', async () => {
  const id = seed('srv_lp_apply', {
    env: { FORGE_VERSION: '47.4.10', MOTD: 'kept' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15' } });
  assert.equal(r.status, 202);
  const task = await settle(r.json.taskId);
  assert.equal(task.state, 'done', task.error);
  assert.deepEqual(task.result, { from: '47.4.10', to: '47.4.15', backupId: 'bkp_test' });
  assert.deepEqual(calls, [
    ['backup', id, 'pre-update', 'Before Forge 47.4.10 → 47.4.15'],
    ['rebuild', id, { FORGE_VERSION: '47.4.15', MOTD: 'kept' }],
  ]);
  const ev = db.get("SELECT * FROM events WHERE server_id = ? AND type = 'loader-version-changed'", id);
  assert.equal(ev.summary, 'Forge version changed to 47.4.15.');
  assert.equal(JSON.parse(ev.details_json).backupId, 'bkp_test');
});

test('a build older than the dropdown cap is accepted when typed', async () => {
  const id = seed('srv_lp_old');
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.3.0' } });
  assert.equal(r.status, 202);
  assert.equal((await settle(r.json.taskId)).state, 'done');
  assert.equal(envOf(id).FORGE_VERSION, '47.3.0');
});

test('an empty version removes the pin and goes back to the default', async () => {
  const id = seed('srv_lp_reset', { env: { FORGE_VERSION: '47.4.15' } });
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '' } });
  assert.equal(r.status, 202);
  assert.equal((await settle(r.json.taskId)).state, 'done');
  assert.deepEqual(envOf(id), {});
  const ev = db.get("SELECT summary FROM events WHERE server_id = ? AND type = 'loader-version-changed'", id);
  assert.equal(ev.summary, 'Forge version reset to the default version.');
});

test('a CurseForge pack gets CF_MOD_LOADER_VERSION, never FORGE_VERSION, and can be reset', async () => {
  const id = seed('srv_lp_cf', {
    type: 'AUTO_CURSEFORGE',
    env: { CF_SLUG: 'somepack', CF_FILE_ID: '123' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  let r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15' } });
  assert.equal(r.status, 202);
  assert.equal((await settle(r.json.taskId)).state, 'done');
  assert.deepEqual(envOf(id), { CF_SLUG: 'somepack', CF_FILE_ID: '123', CF_MOD_LOADER_VERSION: '47.4.15' });

  r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '' } });
  assert.equal(r.status, 202);
  assert.equal((await settle(r.json.taskId)).state, 'done');
  assert.deepEqual(envOf(id), { CF_SLUG: 'somepack', CF_FILE_ID: '123' });
  const ev = db.get(
    "SELECT summary FROM events WHERE server_id = ? AND type = 'loader-version-changed' ORDER BY id DESC LIMIT 1",
    id
  );
  assert.equal(ev.summary, "Forge version reset to the modpack's version.");
});

test('Fabric builds are checked without a Minecraft version in the message', async () => {
  const id = seed('srv_lp_fabric', { type: 'FABRIC' });
  const bad = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '0.1.0' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, "Fabric 0.1.0 isn't a published build.");
  const ok = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '0.16.14' } });
  assert.equal(ok.status, 202);
  assert.equal((await settle(ok.json.taskId)).state, 'done');
  assert.equal(envOf(id).FABRIC_LOADER_VERSION, '0.16.14');
});

test('a failed backup stops the change before the pin is touched', async () => {
  const id = seed('srv_lp_nobackup', { env: { FORGE_VERSION: '47.4.10' } });
  backups.createBackup = async () => {
    throw Object.assign(new Error('Not enough disk space for a backup'), { status: 507 });
  };
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.15' } });
  const task = await settle(r.json.taskId);
  assert.equal(task.state, 'failed');
  assert.equal(envOf(id).FORGE_VERSION, '47.4.10');
});

test('every step label is an in-progress line ending in an ellipsis', async () => {
  const { applyLoaderVersion } = require('../src/services/loaderPin');
  const id = seed('srv_lp_steps', { type: 'AUTO_CURSEFORGE', env: { CF_SLUG: 'p', CF_FILE_ID: '1' } });
  fs.writeFileSync(dataPath('servers', id, '.forge-manifest.json'), JSON.stringify({ forgeVersion: '47.4.10' }));
  const steps = [];
  await applyLoaderVersion(id, '', { actor: 'test', task: { step: (s) => steps.push(s) } }).catch(() => {});
  // '' on an unpinned pack is accepted by the service (the route refuses it as
  // a no-op first); what matters here is the wording of every step.
  assert.ok(steps.length >= 3);
  for (const s of steps) assert.match(s, /…$/, s);
  assert.ok(steps.includes("Switching to the modpack's version of Forge…"));
});

// ---- The update checker -----------------------------------------------------

test('the Updates page offers the recommended Forge build, and never a step back', async () => {
  const checker = require('../src/updates/checker');
  const behind = seed('srv_lp_chk_behind', { env: { FORGE_VERSION: '47.3.0' } });
  const ahead = seed('srv_lp_chk_ahead', { env: { FORGE_VERSION: '47.4.15' } });
  await checker.checkAll({ actor: 'test' });
  const row = (id) => db.get("SELECT * FROM update_checks WHERE subject_type = 'loader_build' AND subject_id = ?", id);
  assert.equal(row(behind).latest_version, '47.4.10', 'the recommended build, not the newest');
  assert.equal(row(ahead).latest_version, null, 'pinned past recommended: nothing to offer');
});

test('the upgrade route now backs up before a loader-build swap', async () => {
  const id = seed('srv_lp_upgrade', { env: { FORGE_VERSION: '47.3.0' } });
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetLoaderBuild: '47.4.10', envKey: 'FORGE_VERSION' },
  });
  assert.equal(r.status, 202);
  const task = await settle(r.json.taskId);
  assert.equal(task.state, 'done', task.error);
  assert.deepEqual(calls[0], ['backup', id, 'pre-update', 'Before loader build 47.3.0 → 47.4.10']);
  assert.equal(envOf(id).FORGE_VERSION, '47.4.10');
});

// ---- The card on the Versions tab -------------------------------------------

test('the Versions tab shows the card with a picker to someone who can change settings', async () => {
  const id = seed('srv_lp_page_admin', {
    env: { FORGE_VERSION: '47.4.10' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  const r = await app.req('GET', `/servers/${id}/updates`, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /<h2[^>]*>Loader Version<\/h2>/);
  assert.match(r.text, /data-loader="forge"/);
  assert.match(r.text, /data-loader-pinned="47\.4\.10"/);
  assert.match(r.text, /Forge 47\.4\.10/);
  assert.match(r.text, /id="loader-select"/);
  assert.match(r.text, /Default \(recommended\)/);
  assert.doesNotMatch(r.text, /notice-warn[^]*?modpack was built for/, 'no pack warning on a plain server');
});

test('a viewer sees the installed build, but no picker', async () => {
  const id = seed('srv_lp_page_viewer', {
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  const r = await app.req('GET', `/servers/${id}/updates`, { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /Loader Version/);
  assert.doesNotMatch(r.text, /id="loader-select"/);
});

test('a CurseForge pack gets the override picker with a warning; a Modrinth pack gets neither', async () => {
  const cf = seed('srv_lp_page_cf', {
    type: 'AUTO_CURSEFORGE',
    env: { CF_SLUG: 'p', CF_FILE_ID: '1' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  fs.mkdirSync(dataPath('servers', cf, 'mods'), { recursive: true });
  let r = await app.req('GET', `/servers/${cf}/updates`, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /id="loader-select"/);
  assert.match(r.text, /The modpack&#x27;s version|The modpack's version/);
  assert.match(r.text, /modpack was built for/);

  const mr = seed('srv_lp_page_mr', {
    type: 'MODRINTH',
    env: { MODRINTH_MODPACK: 'p', MODRINTH_VERSION: 'v' },
    manifest: { loader: 'fabric', body: { origin: { loader: '0.16.14' } } },
  });
  r = await app.req('GET', `/servers/${mr}/updates`, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /Fabric 0\.16\.14/);
  assert.match(r.text, /has no override/);
  assert.doesNotMatch(r.text, /id="loader-select"/);
});

test('a build Forge skipped is refused with the closest newer one named', async () => {
  // Forge never published 47.4.14; "needs 47.4.14 or above" is met by 47.4.15.
  const id = seed('srv_lp_skipped');
  const r = await app.req('POST', `/api/servers/${id}/loader-version`, { cookie, body: { version: '47.4.14' } });
  assert.equal(r.status, 400);
  assert.equal(
    r.json.error,
    "Forge 47.4.14 isn't a published build for Minecraft 1.20.1. The closest newer build is 47.4.15."
  );
  assert.deepEqual(envOf(id), {});
});

test('a pin that has not been installed yet says it installs on the next start', async () => {
  const pending = seed('srv_lp_page_pending', {
    env: { FORGE_VERSION: '47.4.15' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.10' } },
  });
  let r = await app.req('GET', `/servers/${pending}/updates`, { cookie, headers: { Accept: 'text/html' } });
  assert.match(r.text, /installs on the next start/);
  const settled = seed('srv_lp_page_settled', {
    env: { FORGE_VERSION: '47.4.15' },
    manifest: { loader: 'forge', body: { minecraftVersion: '1.20.1', forgeVersion: '47.4.15' } },
  });
  r = await app.req('GET', `/servers/${settled}/updates`, { cookie, headers: { Accept: 'text/html' } });
  assert.doesNotMatch(r.text, /installs on the next start/);
});

test('a dry run checks the change without starting anything', async () => {
  const id = seed('srv_lp_dry', { env: { FORGE_VERSION: '47.4.10' } });
  const ok = await app.req('POST', `/api/servers/${id}/loader-version`, {
    cookie,
    body: { version: '47.4.15', dryRun: true },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json, { ok: true });
  assert.deepEqual(calls, []);
  assert.equal(envOf(id).FORGE_VERSION, '47.4.10');
  const bad = await app.req('POST', `/api/servers/${id}/loader-version`, {
    cookie,
    body: { version: '47.4.14', dryRun: true },
  });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /closest newer build is 47\.4\.15/);
  const viewer = await app.req('POST', `/api/servers/${id}/loader-version`, {
    cookie: viewerCookie,
    body: { version: '47.4.15', dryRun: true },
  });
  assert.equal(viewer.status, 403, 'a dry run needs the same permission');
});
