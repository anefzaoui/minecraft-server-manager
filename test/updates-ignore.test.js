'use strict';

// "Ignore this update" for the non-content update kinds (mc_version here, same
// path for pack / image / loader_build). An ignored row stays on the Updates
// page (greyed, flagged) but drops out of countOutdated(); a genuinely newer
// build re-surfaces on its own.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const checker = require('../src/updates/checker');

function seedMcVersionUpdate(serverId, { current, latest }) {
  // update_policy defaults to 'manual', which listOutdated()/countOutdated()
  // now exclude - the ignore behaviour under test only applies to a server
  // that would otherwise surface the update.
  db.run(
    "UPDATE servers SET type = 'FABRIC', mc_version = ?, update_policy = 'notify' WHERE id = ?",
    current,
    serverId
  );
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name)
     VALUES ('mc_version', ?, ?, ?, ?)
     ON CONFLICT(subject_type, subject_id) DO UPDATE SET
       current_version = excluded.current_version, latest_version = excluded.latest_version,
       latest_name = excluded.latest_name, ignored_version = NULL`,
    serverId,
    current,
    latest,
    latest
  );
}

const rowFor = (sid) => checker.listOutdated().find((r) => r.serverId === sid && r.subjectType === 'mc_version');

test('setup', async () => {
  await app.start();
});

test('ignoring an mc_version update greys the row and drops the count; un-ignore restores it', () => {
  const sid = app.seedServer('srv_upd_ignore');
  seedMcVersionUpdate(sid, { current: '26.1.2', latest: '26.2' });

  const before = rowFor(sid);
  assert.ok(before, 'row is listed');
  assert.equal(before.ignored, false);
  const countBefore = checker.countOutdated();

  const res = checker.setUpdateIgnored('mc_version', sid, { ignore: true, actor: 'tester' });
  assert.equal(res.ignored, '26.2');

  const after = rowFor(sid);
  assert.ok(after, 'row still listed so it can be un-ignored');
  assert.equal(after.ignored, true);
  assert.equal(checker.countOutdated(), countBefore - 1);

  checker.setUpdateIgnored('mc_version', sid, { ignore: false, actor: 'tester' });
  assert.equal(rowFor(sid).ignored, false);
  assert.equal(checker.countOutdated(), countBefore);
});

test('ignore is version-specific: a newer MC release than the ignored one surfaces again', () => {
  const sid = app.seedServer('srv_upd_ignore_newer');
  seedMcVersionUpdate(sid, { current: '26.1.2', latest: '26.2' });
  checker.setUpdateIgnored('mc_version', sid, { ignore: true, actor: 'tester' });
  assert.equal(rowFor(sid).ignored, true);

  db.run(
    "UPDATE update_checks SET latest_version = '26.3', latest_name = '26.3' WHERE subject_type = 'mc_version' AND subject_id = ?",
    sid
  );
  assert.equal(rowFor(sid).ignored, false, 'a build newer than the ignored one is offered again');
});

test('setUpdateIgnored rejects when there is no pending update', () => {
  const sid = app.seedServer('srv_upd_ignore_none');
  assert.throws(() => checker.setUpdateIgnored('mc_version', sid, { ignore: true }), /No pending update/i);
});

test('setUpdateIgnored refuses content subjects (handled per-mod instead)', () => {
  assert.throws(() => checker.setUpdateIgnored('content', 'sc_whatever', { ignore: true }), /per-mod/i);
});

test('the auto update policy never installs a version the user chose to ignore', async () => {
  const upgrade = require('../src/updates/upgrade');
  const sid = app.seedServer('srv_upd_auto_ign');
  db.run("UPDATE servers SET update_policy = 'auto' WHERE id = ?", sid);
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES (?, 'modrinth', 'some-pack', 'Some Pack', 'ver_old', '1.0.0')`,
    sid
  );
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name)
     VALUES ('pack', ?, 'ver_old', 'ver_new', '1.1.0')`,
    sid
  );
  checker.setUpdateIgnored('pack', sid, { ignore: true, actor: 'tester' });

  const ignored = await upgrade.runAutoUpgrades({ actor: 'scheduler' });
  assert.equal(ignored.skipped, 1, 'the ignored build was skipped');
  assert.equal(ignored.applied + ignored.failed, 0, 'no upgrade was even attempted');
  assert.equal(
    db.get("SELECT COUNT(*) AS n FROM events WHERE server_id = ? AND type IN ('update-applied','update-failed')", sid)
      .n,
    0
  );

  // Un-ignore: the nightly run attempts the upgrade again (it fails here - no
  // network - which proves it was attempted).
  checker.setUpdateIgnored('pack', sid, { ignore: false, actor: 'tester' });
  const attempted = await upgrade.runAutoUpgrades({ actor: 'scheduler' });
  assert.equal(attempted.skipped, 0);
  assert.equal(attempted.applied + attempted.failed, 1, 'the upgrade was attempted once un-ignored');
});

test('teardown', async () => {
  await app.stop();
});
