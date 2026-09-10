'use strict';

// "Ignore this update" for an overlay mod: while the ignored version is still
// the newest one seen, it must not surface as an available update anywhere
// (mods tab item, sidebar count). A genuinely newer build re-surfaces on its own.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const mods = require('../src/services/mods');
const checker = require('../src/updates/checker');

/** A real jar on disk so listContent() surfaces the row (not "missing"). */
function writeJar(serverId, name = 'sodium.jar') {
  const dir = dataPath('servers', serverId, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), 'jar');
}

/** Overlay mod row + its library_files row + a pending update_checks row. */
function seedOverlayModWithUpdate(serverId, { installed, latestName, latestId }) {
  writeJar(serverId);
  const libId = `lib_${serverId}`;
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, file_id, version)
     VALUES (?, 'mod', 'Sodium', 'sodium.jar', ?, ?, 100, 'modrinth', 'AABBCCDD', ?, ?)`,
    libId,
    `library/${libId}`,
    `sha-${libId}`,
    latestId,
    installed
  );
  const scId = `sc_${serverId}`;
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version)
     VALUES (?, ?, ?, 'mod', 'overlay', 'Sodium', 'sodium.jar', ?)`,
    scId,
    serverId,
    libId,
    installed
  );
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name)
     VALUES ('content', ?, ?, ?, ?)`,
    scId,
    installed,
    latestId,
    latestName
  );
  return scId;
}

test('an ignored update disappears from listContent and the outdated count; un-ignore brings it back', async () => {
  const sid = app.seedServer('srv_ignore_upd');
  // update_policy defaults to 'manual', which countOutdated() now excludes.
  db.run("UPDATE servers SET type = 'FABRIC', mc_version = '1.20.1', update_policy = 'notify' WHERE id = ?", sid);
  const scId = seedOverlayModWithUpdate(sid, { installed: '0.5.3', latestName: '0.5.8', latestId: 'ver-058' });

  const before = (await mods.listContent(sid)).find((i) => i.file === 'sodium.jar');
  assert.equal(before.updateAvailable, '0.5.8');
  assert.equal(before.updateIgnored, null);
  const countBefore = checker.countOutdated();

  const res = mods.setIgnoredUpdate(sid, { contentId: scId }, { ignore: true, actor: 'tester' });
  assert.equal(res.ignored, '0.5.8');

  const after = (await mods.listContent(sid)).find((i) => i.file === 'sodium.jar');
  assert.equal(after.updateAvailable, null, 'ignored update no longer offered');
  assert.equal(after.updateIgnored, '0.5.8', 'still reported as ignored so the UI can offer un-ignore');
  assert.equal(checker.countOutdated(), countBefore - 1, 'sidebar count drops by one');

  mods.setIgnoredUpdate(sid, { contentId: scId }, { ignore: false, actor: 'tester' });
  const restored = (await mods.listContent(sid)).find((i) => i.file === 'sodium.jar');
  assert.equal(restored.updateAvailable, '0.5.8', 'un-ignore re-offers the update');
  assert.equal(checker.countOutdated(), countBefore);
});

test('ignore is version-specific: a newer build than the ignored one still surfaces', async () => {
  const sid = app.seedServer('srv_ignore_newer');
  db.run("UPDATE servers SET type = 'FABRIC', mc_version = '1.20.1', update_policy = 'notify' WHERE id = ?", sid);
  const scId = seedOverlayModWithUpdate(sid, { installed: '0.5.3', latestName: '0.5.8', latestId: 'ver-058' });
  mods.setIgnoredUpdate(sid, { contentId: scId }, { ignore: true, actor: 'tester' });

  // The checker later sees an even newer build.
  db.run(
    "UPDATE update_checks SET latest_version = 'ver-060', latest_name = '0.6.0' WHERE subject_type = 'content' AND subject_id = ?",
    scId
  );

  const item = (await mods.listContent(sid)).find((i) => i.file === 'sodium.jar');
  assert.equal(item.updateAvailable, '0.6.0', 'a build newer than the ignored one is offered again');
  assert.equal(item.updateIgnored, null);
});

test('setIgnoredUpdate rejects when there is no pending update to ignore', async () => {
  const sid = app.seedServer('srv_ignore_none');
  db.run("UPDATE servers SET type = 'FABRIC' WHERE id = ?", sid);
  const libId = `lib_${sid}`;
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, version)
     VALUES (?, 'mod', 'Sodium', 'sodium.jar', ?, ?, 100, 'modrinth', 'AABBCCDD', '0.5.8')`,
    libId,
    `library/${libId}`,
    `sha-${libId}`
  );
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version)
     VALUES (?, ?, ?, 'mod', 'overlay', 'Sodium', 'sodium.jar', '0.5.8')`,
    `sc_${sid}`,
    sid,
    libId
  );
  assert.throws(() => mods.setIgnoredUpdate(sid, { contentId: `sc_${sid}` }, { ignore: true }), /No pending update/i);
});

test('setIgnoredUpdate refuses pack-managed content', async () => {
  const sid = app.seedServer('srv_ignore_pack');
  db.run("UPDATE servers SET type = 'AUTO_CURSEFORGE' WHERE id = ?", sid);
  db.run(
    `INSERT INTO server_content (id, server_id, kind, managed_by, name, filename, version)
     VALUES (?, ?, 'mod', 'pack', 'Some Pack Mod', 'packmod.jar', '1.0')`,
    `sc_${sid}`,
    sid
  );
  assert.throws(
    () => mods.setIgnoredUpdate(sid, { contentId: `sc_${sid}` }, { ignore: true }),
    /Pack-managed content updates with the pack/i
  );
});
