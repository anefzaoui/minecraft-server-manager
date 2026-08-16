'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const packs = require('../src/services/packs');
const gtnhApi = require('../src/services/gtnhApi');
const rawIndex = require('./fixtures/gtnh-versions.json');

/** Serve the fixture instead of the live index, for every gtnhApi network call. */
function stubIndex() {
  const entries = gtnhApi.normalizeIndex(rawIndex);
  const realList = gtnhApi.listVersions;
  const realGet = gtnhApi.getVersion;
  const realLatest = gtnhApi.latest;
  gtnhApi.listVersions = async ({ includeBeta = false } = {}) => gtnhApi.filterVersions(entries, { includeBeta });
  gtnhApi.getVersion = async (v) => {
    const found = entries.find((e) => e.version === v);
    if (!found) throw Object.assign(new Error(`Unknown GTNH pack version: ${v}`), { status: 404 });
    return found;
  };
  gtnhApi.latest = async ({ includeBeta = false } = {}) => gtnhApi.pickLatest(entries, { includeBeta });
  return () => {
    gtnhApi.listVersions = realList;
    gtnhApi.getVersion = realGet;
    gtnhApi.latest = realLatest;
  };
}

test('applyPack stores the java cap and channel on the pin', async () => {
  const id = app.seedServer('srv_gtnhpin');
  await packs.applyPack(
    id,
    {
      platform: 'gtnh',
      projectRef: 'gtnh',
      projectName: 'GT New Horizons',
      versionId: '2.8.4',
      versionName: '2.8.4',
      mcVersion: '1.7.10',
      maxJavaVersion: 25,
      channel: 'stable',
    },
    { actor: 'test', force: true }
  );
  const pin = db.get('SELECT * FROM server_packs WHERE server_id = ?', id);
  assert.equal(pin.platform, 'gtnh');
  assert.equal(pin.max_java_version, 25);
  assert.equal(pin.channel, 'stable');
});

test('applyPack leaves the new columns null for other platforms', async () => {
  const id = app.seedServer('srv_mrpin');
  await packs.applyPack(
    id,
    {
      platform: 'modrinth',
      projectRef: 'sop',
      projectName: 'Simply Optimized',
      versionId: 'abc123',
      versionName: '1.0.0',
      mcVersion: '1.21.1',
    },
    { actor: 'test', force: true }
  );
  const pin = db.get('SELECT * FROM server_packs WHERE server_id = ?', id);
  assert.equal(pin.max_java_version, null);
  assert.equal(pin.channel, null);
});

test('resolvePack("gtnh") defaults to the newest stable version', async () => {
  const restore = stubIndex();
  try {
    const resolved = await packs.resolvePack('gtnh', 'gtnh', {});
    assert.equal(resolved.platform, 'gtnh');
    assert.equal(resolved.projectRef, 'gtnh');
    assert.equal(resolved.projectName, 'GT New Horizons');
    assert.equal(resolved.versionId, '2.8.4');
    assert.equal(resolved.versionName, '2.8.4');
    assert.equal(resolved.mcVersion, '1.7.10');
    assert.equal(resolved.maxJavaVersion, 25);
    assert.equal(resolved.channel, 'stable');
    assert.equal(resolved.javaTag, 'java25');
  } finally {
    restore();
  }
});

test('resolvePack("gtnh") honours includeBeta when no explicit versionId is given', async () => {
  const restore = stubIndex();
  try {
    // Default (includeBeta omitted → false): newest STABLE, matching the
    // fixture's newest stable entry (2.8.4), never the newer 2.9.0-beta-2.
    const stableDefault = await packs.resolvePack('gtnh', 'gtnh', {});
    assert.equal(stableDefault.versionId, '2.8.4');
    assert.equal(stableDefault.channel, 'stable');

    // Regression coverage for the upgrade-button downgrade bug: a caller that
    // knows the pin is beta-tracking must be able to ask for the newest beta.
    const betaLatest = await packs.resolvePack('gtnh', 'gtnh', { includeBeta: true });
    assert.equal(betaLatest.versionId, '2.9.0-beta-2');
    assert.equal(betaLatest.channel, 'beta');
  } finally {
    restore();
  }
});

test('resolvePack("gtnh") pins an explicit version and reports its own java tag', async () => {
  const restore = stubIndex();
  try {
    const resolved = await packs.resolvePack('gtnh', 'gtnh', { versionId: '2.7.4' });
    assert.equal(resolved.versionId, '2.7.4');
    assert.equal(resolved.maxJavaVersion, 21);
    assert.equal(resolved.javaTag, 'java21');
    const beta = await packs.resolvePack('gtnh', 'gtnh', { versionId: '2.9.0-beta-2' });
    assert.equal(beta.channel, 'beta');
  } finally {
    restore();
  }
});

test('resolvePack("gtnh") offers every version, tagged for the picker', async () => {
  const restore = stubIndex();
  try {
    const { allVersions } = await packs.resolvePack('gtnh', 'gtnh', {});
    // Betas are included in the list — the wizard filters them client-side.
    assert.equal(allVersions[0].id, '2.9.0-beta-2');
    assert.equal(allVersions[0].type, 'beta');
    assert.equal(allVersions.find((v) => v.id === '2.8.4').type, 'release');
    assert.equal(allVersions.find((v) => v.id === '2.8.4').maxJavaVersion, 25);
    assert.equal(allVersions.find((v) => v.id === '2.8.4').date, '2025/12/23');
  } finally {
    restore();
  }
});

test('resolvePack("gtnh") rejects a version that is not in the index', async () => {
  const restore = stubIndex();
  try {
    await assert.rejects(() => packs.resolvePack('gtnh', 'gtnh', { versionId: '../../etc/passwd' }), /Unknown GTNH/);
    await assert.rejects(() => packs.resolvePack('gtnh', 'gtnh', { versionId: '1.2.3' }), /Unknown GTNH/);
  } finally {
    restore();
  }
});

test('packEnv("gtnh") pins the version and disables the image update check', () => {
  const env = packs.packEnv({ platform: 'gtnh', projectRef: 'gtnh', versionId: '2.8.4' });
  assert.deepEqual(env, { TYPE: 'GTNH', GTNH_PACK_VERSION: '2.8.4', SKIP_GTNH_UPDATE_CHECK: 'true' });
});

test('applying GTNH over a CurseForge pin strips the stale CF_ vars', async () => {
  const restore = stubIndex();
  try {
    const id = app.seedServer('srv_swap');
    db.run(`UPDATE servers SET env_json = ? WHERE id = ?`, JSON.stringify({ CF_SLUG: 'old', VIEW_DISTANCE: '10' }), id);
    const resolved = await packs.resolvePack('gtnh', 'gtnh', {});
    await packs.applyPack(id, resolved, { actor: 'test', force: true });
    const env = JSON.parse(db.get('SELECT env_json FROM servers WHERE id = ?', id).env_json);
    assert.equal(env.CF_SLUG, undefined);
    assert.equal(env.GTNH_PACK_VERSION, '2.8.4');
    assert.equal(env.VIEW_DISTANCE, '10'); // unrelated user env survives
  } finally {
    restore();
  }
});

test('applying a non-GTNH pack over a GTNH pin strips GTNH_PACK_VERSION and SKIP_GTNH_UPDATE_CHECK', async () => {
  const restore = stubIndex();
  try {
    const id = app.seedServer('srv_swap2');
    const resolved = await packs.resolvePack('gtnh', 'gtnh', {});
    await packs.applyPack(id, resolved, { actor: 'test', force: true });
    let env = JSON.parse(db.get('SELECT env_json FROM servers WHERE id = ?', id).env_json);
    assert.equal(env.GTNH_PACK_VERSION, '2.8.4');
    assert.equal(env.SKIP_GTNH_UPDATE_CHECK, 'true');
    db.run(`UPDATE servers SET env_json = ? WHERE id = ?`, JSON.stringify({ ...env, VIEW_DISTANCE: '10' }), id);

    // Hand-built descriptor, the way the Task 3 tests do — no stub needed for a non-GTNH platform.
    await packs.applyPack(
      id,
      {
        platform: 'modrinth',
        projectRef: 'sop',
        projectName: 'Simply Optimized',
        versionId: 'abc123',
        versionName: '1.0.0',
        mcVersion: '1.21.1',
      },
      { actor: 'test', force: true }
    );
    env = JSON.parse(db.get('SELECT env_json FROM servers WHERE id = ?', id).env_json);
    assert.equal(env.GTNH_PACK_VERSION, undefined);
    assert.equal(env.SKIP_GTNH_UPDATE_CHECK, undefined);
    assert.equal(env.VIEW_DISTANCE, '10'); // unrelated user env survives
  } finally {
    restore();
  }
});

test('latestFor("gtnh") offers the newest stable to a server pinned on an older stable, never a newer beta', async () => {
  const restore = stubIndex();
  try {
    const id = app.seedServer('srv_latest_stable');
    const resolved = await packs.resolvePack('gtnh', 'gtnh', { versionId: '2.7.4' });
    await packs.applyPack(id, resolved, { actor: 'test', force: true });
    const info = await packs.latestFor(id);
    assert.deepEqual(
      Object.keys(info).sort(),
      ['current', 'latest', 'platform', 'projectName', 'projectRef', 'updateAvailable'].sort()
    );
    assert.equal(info.current.id, '2.7.4');
    assert.equal(info.latest.id, '2.8.4'); // newest stable, not the newer 2.9.0-beta-2
    assert.equal(info.updateAvailable, true);
    assert.equal(info.projectName, 'GT New Horizons');
    assert.equal(info.projectRef, 'gtnh');
    assert.equal(info.platform, 'gtnh');
  } finally {
    restore();
  }
});

test('latestFor("gtnh") reports no update once already on the newest stable', async () => {
  const restore = stubIndex();
  try {
    const id = app.seedServer('srv_latest_current');
    const resolved = await packs.resolvePack('gtnh', 'gtnh', {}); // newest stable: 2.8.4
    await packs.applyPack(id, resolved, { actor: 'test', force: true });
    const info = await packs.latestFor(id);
    assert.equal(info.current.id, '2.8.4');
    assert.equal(info.latest.id, '2.8.4');
    assert.equal(info.updateAvailable, false);
  } finally {
    restore();
  }
});

test('latestFor("gtnh") tracks betas for a server pinned to a beta', async () => {
  const restore = stubIndex();
  try {
    const id = app.seedServer('srv_latest_beta');
    const resolved = await packs.resolvePack('gtnh', 'gtnh', { versionId: '2.9.0-beta-2' });
    await packs.applyPack(id, resolved, { actor: 'test', force: true });
    const info = await packs.latestFor(id);
    assert.equal(info.current.id, '2.9.0-beta-2');
    assert.equal(info.latest.id, '2.9.0-beta-2'); // the newest beta
  } finally {
    restore();
  }
});

const serversService = require('../src/services/servers');

test('resolveImage uses the pinned pack java cap for GTNH servers', async () => {
  const restore = stubIndex();
  try {
    const id = app.seedServer('srv_gtnhimg');
    db.run(`UPDATE servers SET type = 'GTNH', mc_version = '1.7.10' WHERE id = ?`, id);
    await packs.applyPack(id, await packs.resolvePack('gtnh', 'gtnh', {}), { actor: 'test', force: true });
    assert.match(serversService.resolveImage(serversService.getServer(id)), /:java25$/);

    await packs.applyPack(id, await packs.resolvePack('gtnh', 'gtnh', { versionId: '2.7.4' }), {
      actor: 'test',
      force: true,
    });
    assert.match(serversService.resolveImage(serversService.getServer(id)), /:java21$/);
  } finally {
    restore();
  }
});

test('resolveImage falls back to java17 for an unpinned GTNH server', () => {
  const id = app.seedServer('srv_gtnhbare');
  db.run(`UPDATE servers SET type = 'GTNH', mc_version = '1.7.10' WHERE id = ?`, id);
  // Hand-made GTNH servers from before the pack platform existed have no pin.
  assert.match(serversService.resolveImage(serversService.getServer(id)), /:java17$/);
});

test('resolveImage still honors an explicit user override', () => {
  const id = app.seedServer('srv_gtnhoverride');
  db.run(`UPDATE servers SET type = 'GTNH', mc_version = '1.7.10', java_tag = 'java8' WHERE id = ?`, id);
  assert.match(serversService.resolveImage(serversService.getServer(id)), /:java8$/);
});
