'use strict';

// Isolated from packs-gtnh.test.js on purpose: checker.checkAll() iterates
// EVERY server in the DB, and that file's shared DB accumulates CurseForge/
// Modrinth-pinned test servers whose real API calls would need network. This
// file seeds only a single GTNH server so checkAll never attempts one.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const packs = require('../src/services/packs');
const gtnhApi = require('../src/services/gtnhApi');
const checker = require('../src/updates/checker');
const rawIndex = require('./fixtures/gtnh-versions.json');

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

test('checkAll caches the per-version GTNH changelog link, not the generic fallback', async () => {
  const restore = stubIndex();
  try {
    const id = app.seedServer('srv_checkall_gtnh');
    // Pin an older stable (2.7.4) so a newer stable (2.8.4) is available.
    const resolved = await packs.resolvePack('gtnh', 'gtnh', { versionId: '2.7.4' });
    await packs.applyPack(id, resolved, { actor: 'test', force: true });

    await checker.checkAll({ actor: 'test' });

    const check = db.get("SELECT * FROM update_checks WHERE subject_type = 'pack' AND subject_id = ?", id);
    assert.ok(check, 'expected a cached update_checks row');
    assert.equal(check.latest_version, '2.8.4');
    // The 2.8.4 fixture entry's own changelog href, not the generic
    // DreamAssemblerXXL changelogs directory checker.js falls back to.
    assert.equal(
      check.changelog_url,
      'https://github.com/GTNewHorizons/DreamAssemblerXXL/blob/master/releases/changelogs/changelog%20from%202.8.3%20to%202.8.4.md'
    );
  } finally {
    restore();
  }
});
