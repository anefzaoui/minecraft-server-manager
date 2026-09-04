'use strict';

// runAutoUpgrades guardrails: it must touch ONLY servers whose policy is
// 'auto' AND that have a genuinely pending pack update. Everything else is a
// no-op - manual/notify servers, up-to-date pins, packless servers (#24).
// The apply/rollback path itself rides upgradePack/rollbackPack, which the
// upgrade orchestrator already exercises.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { runAutoUpgrades } = require('../src/updates/upgrade');

let port = 25900;
function seedServer(id, policy) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, 'AUTO_CURSEFORGE', ?, ?, 'x', 1024, 1536, 'stopped', ?, '{}')`,
    id,
    id,
    port,
    port + 1,
    policy
  );
}

function seedPack(id, pinned) {
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES (?, 'curseforge', 'atm10', 'All the Mods 10', ?, ?)`,
    id,
    pinned,
    `v${pinned}`
  );
}

function seedCheck(id, latest) {
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name, checked_at)
     VALUES ('pack', ?, 'v100', ?, ?, datetime('now'))`,
    id,
    latest,
    latest && `v${latest}`
  );
}

test('non-auto policies are never touched, even with updates pending', async () => {
  seedServer('srv_man', 'manual');
  seedPack('srv_man', '100');
  seedCheck('srv_man', '200');
  seedServer('srv_not', 'notify');
  seedPack('srv_not', '100');
  seedCheck('srv_not', '200');

  assert.deepEqual(await runAutoUpgrades(), { applied: 0, skipped: 0, failed: 0 });
});

test('an auto server that is already up to date is a no-op', async () => {
  seedServer('srv_current', 'auto');
  seedPack('srv_current', '300');
  // checker leaves latest_version NULL when up to date; also cover a stale
  // row that matches the pin exactly.
  seedCheck('srv_current', '300');
  assert.deepEqual(await runAutoUpgrades(), { applied: 0, skipped: 0, failed: 0 });
});

test('an auto server without a managed pack is left alone', async () => {
  seedServer('srv_packless', 'auto');
  seedCheck('srv_packless', '200');
  assert.deepEqual(await runAutoUpgrades(), { applied: 0, skipped: 0, failed: 0 });
});
