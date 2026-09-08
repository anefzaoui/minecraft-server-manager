'use strict';

// 'manual' update policy must mean "leave me alone": servers set to it are
// excluded from the Updates page and the sidebar badge count, while 'notify'
// servers keep appearing (#24). The underlying update_checks rows still exist
// for both, so flipping the policy back shows current state instantly.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { listOutdated, countOutdated } = require('../src/updates/checker');

function seedPackServer(id, policy) {
  const port = id === 'srv_manual' ? 25800 : 25802;
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, 'AUTO_CURSEFORGE', ?, ?, 'x', 1024, 1536, 'stopped', ?, '{}')`,
    id,
    id,
    port,
    port + 1,
    policy
  );
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES (?, 'curseforge', 'atm10', 'All the Mods 10', '100', '1.0')`,
    id
  );
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name, checked_at)
     VALUES ('pack', ?, '1.0', '200', '2.0', datetime('now'))`,
    id
  );
}

seedPackServer('srv_manual', 'manual');
seedPackServer('srv_notify', 'notify');

test('listOutdated hides manual-policy servers and keeps notify ones', () => {
  const rows = listOutdated();
  const byServer = rows.map((r) => r.serverId);
  assert.ok(byServer.includes('srv_notify'), 'notify server should be listed');
  assert.ok(!byServer.includes('srv_manual'), 'manual server must not be listed');
});

test('countOutdated matches the same filter', () => {
  assert.equal(countOutdated(), 1);
});

test('the check row itself is kept for manual servers', () => {
  const row = db.get("SELECT * FROM update_checks WHERE subject_type = 'pack' AND subject_id = 'srv_manual'");
  assert.ok(row && row.latest_version === '200');
});
