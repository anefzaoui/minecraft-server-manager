'use strict';

// Tiny versioned migration runner. Migrations live in ./migrations as
// NNN_name.js files exporting { up(db) }. Applied in filename order inside a
// transaction; applied versions recorded in schema_migrations.

const fs = require('node:fs');
const path = require('node:path');
const db = require('./index');
const logger = require('../logger')(path.basename(__filename));

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Before a later release renumbered duplicate 3-digit prefixes (010-015) to
// unique ascending values, schema_migrations recorded those migrations under
// their old filenames. A renamed file would otherwise read as "not applied" and
// re-run against a database that already has its work done. Legacy aliases map
// each current filename back to the filename it shipped under; if any old name
// is already recorded, the migration is treated as applied and re-recorded
// under its current name. Once every installing panel has passed through this
// release the map could be dropped, but keeping it is harmless - the old
// versions never appear on a fresh install.
const LEGACY_MIGRATION_ALIASES = {
  '011_wizard_chat': ['010_wizard_chat'],
  '012_player_notes': ['011_player_notes'],
  '013_wizard_invocation_name': ['011_wizard_invocation_name'],
  '014_player_events_index': ['012_player_events_index'],
  '015_wizard_powers': ['012_wizard_powers'],
  '016_session_user_id': ['013_session_user_id'],
  '017_wizard_outreach': ['013_wizard_outreach'],
  '018_backup_pre_restore_reason': ['014_backup_pre_restore_reason'],
  '019_wizard_power_controllers': ['014_wizard_power_controllers'],
  '020_api_tokens': ['015_api_tokens'],
  '021_content_ignored_update': ['015_content_ignored_update'],
  '022_crash_mclogs': ['015_crash_mclogs'],
  '023_datapack_jar_cleanup': ['016_datapack_jar_cleanup'],
  '024_update_check_ignore': ['017_update_check_ignore'],
};

function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(db.all('SELECT version FROM schema_migrations').map((r) => r.version));
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.js$/.test(f))
    .sort();

  // Duplicate number prefixes were how the pre-renumber drift sneaked in; make
  // a recurred one a loud boot failure instead of a silent ordering change.
  const seenNumbers = new Map();
  for (const file of files) {
    const prefix = file.slice(0, 3);
    const prior = seenNumbers.get(prefix);
    if (prior) {
      throw new Error(
        `Duplicate migration number ${prefix}: "${prior}" and "${file}" both use it. ` +
          'Migration files must each have a unique 3-digit prefix (they are applied in filename order).'
      );
    }
    seenNumbers.set(prefix, file);
  }

  let count = 0;
  for (const file of files) {
    const version = file.replace(/\.js$/, '');
    if (applied.has(version)) continue;
    const legacy = LEGACY_MIGRATION_ALIASES[version];
    if (legacy && legacy.some((old) => applied.has(old))) {
      // The work shipped under old = <legacy>; just track it under version.
      db.run('INSERT INTO schema_migrations (version) VALUES (?)', version);
      applied.add(version);
      logger.info('Re-recorded a renumbered migration under its current filename.', { version, legacy });
      continue;
    }
    const { up } = require(path.join(MIGRATIONS_DIR, file));
    db.transaction(() => {
      up(db);
      db.run('INSERT INTO schema_migrations (version) VALUES (?)', version);
    });
    count += 1;
    logger.info('Applied a database migration.', { version });
  }
  return count;
}

module.exports = { migrate };
