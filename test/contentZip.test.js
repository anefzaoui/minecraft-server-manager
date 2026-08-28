'use strict';

// Mod-zip importer: manifest parsing, zip-type detection, preview verdicts,
// tolerant bulk import, and the overrides-apply safety battery.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const contentZip = require('../src/services/contentZip');
const library = require('../src/services/library');
const apiKeys = require('../src/services/apiKeys');
const { tempZip } = require('./helpers/zipfix');

const realFetch = globalThis.fetch;
function stubRegistries(handlers) {
  globalThis.fetch = (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    for (const [frag, handler] of Object.entries(handlers)) {
      if (url.includes(frag)) {
        return Promise.resolve({ ok: true, status: 200, json: async () => handler(new URL(url), init) });
      }
    }
    return realFetch(input, init);
  };
}
function unstub() {
  globalThis.fetch = realFetch;
  db.run("DELETE FROM api_cache WHERE key LIKE 'modrinth:%' OR key LIKE 'curseforge:%'");
}

const MANIFEST = {
  manifestType: 'minecraftModpack',
  manifestVersion: 1,
  name: 'Kids Pack',
  version: '1.0',
  author: 'gleep',
  minecraft: { version: '1.20.1', modLoaders: [{ id: 'forge-47.2.20', primary: true }] },
  files: [
    { projectID: 100, fileID: 1000, required: true },
    { projectID: 200, fileID: 2000, required: true },
    { projectID: 300, fileID: 3000, required: false },
  ],
  overrides: 'overrides',
};

// CF bulk stubs: mod 100 downloadable, 200 blocked (null downloadUrl), 300 gone.
const CF_HANDLERS = {
  'api.curseforge.com/v1/mods/files': () => ({
    data: [
      {
        id: 1000,
        modId: 100,
        displayName: 'Alpha 1.2',
        fileName: 'alpha-1.2.jar',
        downloadUrl: 'https://edge.forgecdn.net/files/alpha-1.2.jar',
        gameVersions: ['1.20.1', 'Forge'],
        releaseType: 1,
      },
      {
        id: 2000,
        modId: 200,
        displayName: 'Bravo 3.4',
        fileName: 'bravo-3.4.jar',
        downloadUrl: null,
        gameVersions: ['1.20.1', 'Forge'],
        releaseType: 1,
      },
    ],
  }),
  'api.curseforge.com/v1/mods': () => ({
    data: [
      { id: 100, slug: 'alpha', name: 'Alpha', classId: 6, downloadCount: 10, latestFiles: [] },
      { id: 200, slug: 'bravo', name: 'Bravo', classId: 6, downloadCount: 10, latestFiles: [] },
      { id: 300, slug: 'gone', name: 'Gone Mod', classId: 6, downloadCount: 10, latestFiles: [] },
    ],
  }),
};

let cookie = '';
test('setup', async () => {
  await app.start();
  cookie = await app.adminCookie();
  apiKeys.setKey('curseforge', 'test-key');
});

// ---- parsePackManifest ----

test('parsePackManifest extracts loader, mc version and files', () => {
  const m = contentZip.parsePackManifest(JSON.stringify(MANIFEST));
  assert.equal(m.name, 'Kids Pack');
  assert.equal(m.mcVersion, '1.20.1');
  assert.equal(m.loader, 'forge');
  assert.equal(m.loaderVersion, '47.2.20');
  assert.equal(m.files.length, 3);
  assert.equal(m.files[2].required, false);
  assert.equal(m.overridesPrefix, 'overrides/');
});

test('parsePackManifest rejects junk', () => {
  assert.throws(() => contentZip.parsePackManifest('not json'), /not valid JSON/);
  assert.throws(() => contentZip.parsePackManifest('{"manifestType":"other"}'), /not a CurseForge modpack/);
});

// ---- inspect ----

test('inspect detects a CurseForge pack export', async () => {
  const zip = await tempZip('pack.zip', {
    'manifest.json': JSON.stringify(MANIFEST),
    'modlist.html': '<ul></ul>',
    'overrides/config/alpha.toml': 'x = 1',
    'overrides/scripts/run.zs': '// kubejs',
  });
  const info = await contentZip.inspect(zip);
  assert.equal(info.type, 'curseforge-pack');
  assert.equal(info.manifest.name, 'Kids Pack');
  assert.equal(info.overridesEntries.length, 2);
});

test('inspect detects a plain jar zip (nested paths, junk ignored)', async () => {
  const zip = await tempZip('jars.zip', {
    'mods/alpha-1.2.jar': 'a',
    'beta.jar': 'b',
    '__MACOSX/mods/._alpha-1.2.jar': 'junk',
    'readme.txt': 'hi',
  });
  const info = await contentZip.inspect(zip);
  assert.equal(info.type, 'jars');
  assert.deepEqual(info.jarEntries.map((e) => e.name).sort(), ['beta.jar', 'mods/alpha-1.2.jar']);
});

test('inspect rejects a zip with neither manifest nor jars', async () => {
  const zip = await tempZip('junk.zip', { 'readme.txt': 'hello' });
  await assert.rejects(() => contentZip.inspect(zip), /Unrecognized zip/);
});

// ---- previewForServer (pack) ----

test('previewForServer resolves a pack against the server: verdicts, blocked, mismatch warnings', async () => {
  const sid = app.seedServer('srv_zipprev'); // PAPER 1.21-ish default; type PAPER, mc null
  db.run("UPDATE servers SET type = 'FORGE', mc_version = '1.20.1' WHERE id = ?", sid);
  const zip = await tempZip('pack.zip', { 'manifest.json': JSON.stringify(MANIFEST), 'overrides/config/a.toml': 'x' });
  stubRegistries(CF_HANDLERS);
  try {
    const p = await contentZip.previewForServer(sid, zip);
    assert.equal(p.type, 'curseforge-pack');
    assert.equal(p.pack.loader, 'forge');
    assert.equal(p.items.length, 3);
    const byId = Object.fromEntries(p.items.map((i) => [i.projectId, i]));
    assert.equal(byId[100].downloadable, true);
    assert.equal(byId[100].verdict.status, 'ok');
    assert.equal(byId[200].downloadable, false);
    assert.match(byId[200].url, /curseforge\.com/);
    assert.equal(byId[300].resolved, false);
    assert.equal(p.overrides.count, 1);
    assert.deepEqual(p.warnings, []); // matching loader+mc → no warnings
    assert.equal('downloadUrl' in JSON.parse(JSON.stringify(byId[100])), false, 'CDN url stays server-side');
  } finally {
    unstub();
  }

  // Mismatched server → warnings
  db.run("UPDATE servers SET type = 'FABRIC', mc_version = '1.21.1' WHERE id = ?", sid);
  stubRegistries(CF_HANDLERS);
  try {
    const p2 = await contentZip.previewForServer(sid, zip);
    assert.equal(p2.warnings.length, 2);
  } finally {
    unstub();
  }
});

// ---- importForServer (pack) ----

test('importForServer installs downloadable entries, reports blocked/missing, honors selections', async () => {
  const sid = app.seedServer('srv_zipimp');
  db.run("UPDATE servers SET type = 'FORGE', mc_version = '1.20.1' WHERE id = ?", sid);
  const zip = await tempZip('pack.zip', { 'manifest.json': JSON.stringify(MANIFEST) });

  // installResolved reaches the network through library.downloadToLibrary —
  // stub it at the module boundary (same object mods.js holds).
  const realDownload = library.downloadToLibrary;
  const downloads = [];
  library.downloadToLibrary = async (url, meta) => {
    downloads.push(url);
    const id = `lib_t${downloads.length}`;
    const rel = `library/mods/${id}.jar`;
    fs.mkdirSync(path.dirname(dataPath(rel)), { recursive: true });
    fs.writeFileSync(dataPath(rel), 'jar');
    db.run(
      `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, file_id, version)
       VALUES (?, 'mod', ?, ?, ?, ?, 3, 'curseforge', ?, ?, ?)`,
      id,
      meta.name,
      meta.filename,
      rel,
      `sha-${id}`,
      meta.projectId,
      meta.fileId,
      meta.version
    );
    return db.get('SELECT * FROM library_files WHERE id = ?', id);
  };
  stubRegistries(CF_HANDLERS);
  try {
    const steps = [];
    const report = await contentZip.importForServer(sid, zip, { actor: 'tester', onStep: (s) => steps.push(s) });
    assert.equal(report.installed.length, 1);
    assert.equal(report.installed[0].name, 'Alpha');
    assert.equal(report.blocked.length, 1);
    assert.equal(report.blocked[0].name, 'Bravo');
    assert.equal(report.failed.length, 1);
    assert.match(report.failed[0].reason, /no longer exists/);
    assert.equal(downloads.length, 1);
    assert.ok(steps.some((s) => /Installing mod 1\/1/.test(s)));
    // server_content row landed with provenance
    const row = db.get(
      "SELECT sc.*, lf.project_id FROM server_content sc JOIN library_files lf ON lf.id = sc.library_id WHERE sc.server_id = ? AND sc.filename = 'alpha-1.2.jar'",
      sid
    );
    assert.ok(row);
    assert.equal(row.project_id, '100');

    // Selections: deselect everything → nothing installs
    const r2 = await contentZip.importForServer(sid, zip, { selections: [9999], actor: 'tester' });
    assert.equal(r2.installed.length, 0);
    assert.equal(r2.skipped.length, 3);
  } finally {
    library.downloadToLibrary = realDownload;
    unstub();
  }
});

// ---- importForServer (jars) ----

test('importForServer installs a jar zip with metadata identities (registries down)', async () => {
  const sid = app.seedServer('srv_zipjars');
  db.run("UPDATE servers SET type = 'FABRIC', mc_version = '1.20.1' WHERE id = ?", sid);
  apiKeys.deleteKey('curseforge');
  const { jarBuffer } = require('./helpers/zipfix');
  const jarA = await jarBuffer({
    'fabric.mod.json': JSON.stringify({ id: 'alpha', name: 'Alpha Mod', version: '1.0' }),
  });
  const jarB = await jarBuffer({ 'fabric.mod.json': JSON.stringify({ id: 'beta', name: 'Beta Mod', version: '2.0' }) });
  const zip = await tempZip('jars.zip', { 'mods/alpha.jar': jarA, 'beta.jar': jarB });

  globalThis.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com')) return Promise.reject(new Error('registry down'));
    return realFetch(input);
  };
  try {
    const report = await contentZip.importForServer(sid, zip, { actor: 'tester' });
    assert.equal(report.installed.length, 2);
    assert.deepEqual(report.installed.map((i) => i.name).sort(), ['Alpha Mod', 'Beta Mod']);
    assert.ok(fs.existsSync(dataPath('servers', sid, 'mods', 'alpha.jar')));
    const row = db.get("SELECT * FROM server_content WHERE server_id = ? AND filename = 'alpha.jar'", sid);
    assert.equal(row.name, 'Alpha Mod');
    assert.equal(row.version, '1.0');
  } finally {
    unstub();
    apiKeys.setKey('curseforge', 'test-key');
  }
});

// ---- previewStandalone (wizard create-from-zip) ----

test('previewStandalone: pack zip carries manifest-derived loader/mc inference', async () => {
  const zip = await tempZip('pack.zip', { 'manifest.json': JSON.stringify(MANIFEST), 'overrides/a.cfg': 'x' });
  stubRegistries(CF_HANDLERS);
  try {
    const p = await contentZip.previewStandalone(zip);
    assert.equal(p.type, 'curseforge-pack');
    assert.deepEqual(p.inferred, { loader: 'forge', mcVersion: '1.20.1', kind: 'mod' });
    assert.equal(p.overrides.count, 1);
  } finally {
    unstub();
  }
});

test('previewStandalone: jar zip infers loader and MC by majority vote', async () => {
  apiKeys.deleteKey('curseforge');
  const { jarBuffer } = require('./helpers/zipfix');
  const a = await jarBuffer({ 'fabric.mod.json': JSON.stringify({ id: 'a', name: 'A', version: '1' }) });
  const b = await jarBuffer({ 'fabric.mod.json': JSON.stringify({ id: 'b', name: 'B', version: '1' }) });
  const c = await jarBuffer({ 'META-INF/mods.toml': `[[mods]]\nmodId="c"\nversion="1"\n` });
  const zip = await tempZip('mix.zip', { 'a.jar': a, 'b.jar': b, 'c.jar': c });
  globalThis.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com')) return Promise.reject(new Error('down'));
    return realFetch(input);
  };
  try {
    const p = await contentZip.previewStandalone(zip);
    assert.equal(p.type, 'jars');
    assert.equal(p.inferred.loader, 'fabric'); // 2 fabric vs 1 forge
    assert.equal(p.inferred.kind, 'mod');
  } finally {
    unstub();
    apiKeys.setKey('curseforge', 'test-key');
  }
});

test('POST /api/mods/zip-preview answers standalone previews over HTTP', async () => {
  apiKeys.deleteKey('curseforge');
  const { jarBuffer } = require('./helpers/zipfix');
  const jar = await jarBuffer({ 'plugin.yml': 'name: Essentials\nversion: 2.20\n' });
  const zip = await tempZip('plugzip.zip', { 'essentials.jar': jar });
  globalThis.fetch = (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com')) return Promise.reject(new Error('down'));
    return realFetch(input, init);
  };
  try {
    const base = await app.start();
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(zip)]), 'plugzip.zip');
    const res = await realFetch(`${base}/api/mods/zip-preview`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: fd,
    });
    const data = await res.json();
    assert.equal(res.status, 200, JSON.stringify(data));
    assert.equal(data.preview.inferred.kind, 'plugin');
    assert.equal(data.preview.inferred.loader, 'paper');
    assert.match(data.uploadToken, /^modzip-/);
    // Clean the parked upload.
    fs.rmSync(dataPath('tmp', data.uploadToken), { force: true });
  } finally {
    unstub();
    apiKeys.setKey('curseforge', 'test-key');
  }
});

// ---- Overrides apply ----

test('applyOverridesTo extracts only overrides/, backs up overwritten files, skips escapes', async () => {
  const sid = app.seedServer('srv_zipovr');
  const serverDir = dataPath('servers', sid);
  fs.mkdirSync(path.join(serverDir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'config', 'alpha.toml'), 'ORIGINAL');
  fs.writeFileSync(path.join(serverDir, 'server.properties'), 'motd=keep');

  const zip = await tempZip('pack.zip', {
    'manifest.json': JSON.stringify(MANIFEST),
    'overrides/config/alpha.toml': 'REPLACED',
    'overrides/config/new.toml': 'NEW',
    'overrides/kubejs/script.js': 'x',
    'not-overrides/evil.txt': 'nope',
  });
  const res = await contentZip.applyOverridesTo(sid, zip, 'overrides/', { actor: 'tester' });
  assert.equal(res.applied, 3);
  assert.equal(res.backedUp, 1);
  assert.ok(res.backupDir && res.backupDir.startsWith('.import-backups/'));
  assert.equal(fs.readFileSync(path.join(serverDir, 'config', 'alpha.toml'), 'utf8'), 'REPLACED');
  assert.equal(fs.readFileSync(path.join(serverDir, 'config', 'new.toml'), 'utf8'), 'NEW');
  assert.equal(fs.readFileSync(path.join(serverDir, res.backupDir, 'config', 'alpha.toml'), 'utf8'), 'ORIGINAL');
  assert.equal(fs.existsSync(path.join(serverDir, 'evil.txt')), false);
  assert.equal(fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8'), 'motd=keep', 'untouched files stay');
});

test('applyOverridesTo refuses zip-slip entries inside overrides/', async () => {
  // archiver sanitizes ../, so build the malicious zip bytes by hand: reuse the
  // raw builder trick from backups-extract via a minimal local copy.
  const zlib = require('node:zlib');
  function makeRawZip(entries) {
    const crc32 = (buf) => (typeof zlib.crc32 === 'function' ? zlib.crc32(buf) >>> 0 : 0);
    const local = [];
    const central = [];
    let offset = 0;
    for (const { name, data } of entries) {
      const nameBuf = Buffer.from(name, 'utf8');
      const body = Buffer.from(data);
      const crc = crc32(body);
      const lfh = Buffer.alloc(30);
      lfh.writeUInt32LE(0x04034b50, 0);
      lfh.writeUInt16LE(20, 4);
      lfh.writeUInt32LE(crc, 14);
      lfh.writeUInt32LE(body.length, 18);
      lfh.writeUInt32LE(body.length, 22);
      lfh.writeUInt16LE(nameBuf.length, 26);
      const localOffset = offset;
      local.push(lfh, nameBuf, body);
      offset += lfh.length + nameBuf.length + body.length;
      const cdh = Buffer.alloc(46);
      cdh.writeUInt32LE(0x02014b50, 0);
      cdh.writeUInt16LE(20, 4);
      cdh.writeUInt16LE(20, 6);
      cdh.writeUInt32LE(crc, 16);
      cdh.writeUInt32LE(body.length, 20);
      cdh.writeUInt32LE(body.length, 24);
      cdh.writeUInt16LE(nameBuf.length, 28);
      cdh.writeUInt32LE(localOffset, 42);
      central.push(cdh, nameBuf);
    }
    const centralStart = offset;
    let centralSize = 0;
    for (const b of central) centralSize += b.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralStart, 16);
    return Buffer.concat([...local, ...central, eocd]);
  }
  const sid = app.seedServer('srv_zipslip');
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-slip-'));
  const zipPath = path.join(dir, 'evil.zip');
  fs.writeFileSync(zipPath, makeRawZip([{ name: 'overrides/../../escape.txt', data: 'evil' }]));
  // yauzl itself rejects `..` entry names ("invalid relative path") before our
  // own containment guard ("escapes") — either refusal is the right outcome.
  await assert.rejects(
    () => contentZip.applyOverridesTo(sid, zipPath, 'overrides/', { actor: 't' }),
    /escapes|invalid relative path/
  );
  assert.equal(fs.existsSync(dataPath('servers', 'escape.txt')), false);
  assert.equal(fs.existsSync(dataPath('escape.txt')), false);
});

test('applyOverridesTo cannot clobber the backup tree itself', async () => {
  const sid = app.seedServer('srv_zipbkp');
  const zip = await tempZip('pack.zip', {
    'overrides/.import-backups/x.txt': 'overwrite-attempt',
    'overrides/ok.txt': 'fine',
  });
  const res = await contentZip.applyOverridesTo(sid, zip, 'overrides/', { actor: 't' });
  assert.equal(res.applied, 1);
  assert.equal(fs.existsSync(path.join(dataPath('servers', sid), '.import-backups', 'x.txt')), false);
});

// ---- Routes ----

test('POST import-zip/preview + import run end-to-end over HTTP (jar zip)', async () => {
  const sid = app.seedServer('srv_ziphttp');
  db.run("UPDATE servers SET type = 'FABRIC', mc_version = '1.20.1' WHERE id = ?", sid);
  apiKeys.deleteKey('curseforge');
  const { jarBuffer } = require('./helpers/zipfix');
  const jar = await jarBuffer({
    'fabric.mod.json': JSON.stringify({ id: 'httpmod', name: 'Http Mod', version: '1.0' }),
  });
  const zip = await tempZip('upload.zip', { 'httpmod.jar': jar });

  globalThis.fetch = (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com')) return Promise.reject(new Error('registry down'));
    return realFetch(input, init);
  };
  try {
    const base = await app.start();
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(zip)]), 'upload.zip');
    const up = await realFetch(`${base}/api/servers/${sid}/mods/import-zip/preview`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: fd,
    });
    const upJson = await up.json();
    assert.equal(up.status, 200, JSON.stringify(upJson));
    assert.equal(upJson.preview.type, 'jars');
    assert.equal(upJson.preview.items[0].identity.name, 'Http Mod');
    assert.match(upJson.uploadToken, /^modzip-/);

    const imp = await app.req('POST', `/api/servers/${sid}/mods/import-zip`, {
      cookie,
      body: { uploadToken: upJson.uploadToken, selections: ['httpmod.jar'] },
    });
    assert.equal(imp.status, 202);
    assert.ok(imp.json.taskId);
    // Task runs async — poll it briefly.
    let task = null;
    for (let i = 0; i < 50; i += 1) {
      const tr = await app.req('GET', `/api/tasks/${imp.json.taskId}`, { cookie });
      task = tr.json && tr.json.task;
      if (task && (task.state === 'done' || task.state === 'failed')) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(task, 'task visible');
    assert.equal(task.state, 'done', JSON.stringify(task));
    assert.equal(task.result.installed.length, 1);
    assert.ok(fs.existsSync(dataPath('servers', sid, 'mods', 'httpmod.jar')));
    assert.equal(fs.existsSync(dataPath('tmp', upJson.uploadToken)), false, 'tmp zip cleaned up');
  } finally {
    unstub();
  }
});

test('teardown', async () => {
  await app.stop();
});
