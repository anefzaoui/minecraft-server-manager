'use strict';

// library_files.meta_checked_at: when the panel last asked the registry to
// complete a row's display metadata (icon, name, version, MC versions).
// Without it a row the registry can never complete - a deleted project, a
// project with no icon, a CurseForge row (which has no MC-version list to
// fill) - was re-fetched on every Mods-tab render, every boot, and every
// nightly backfill, forever. The stamp lets those paths skip a row checked
// recently and lets the nightly job retry it later.

function up(db) {
  db.exec(`ALTER TABLE library_files ADD COLUMN meta_checked_at TEXT`);
}

module.exports = { up };
