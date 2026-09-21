'use strict';

// Minecraft version compatibility scans.
//
// version_compat holds one row per server: the result of the manual "check
// future versions" scan (which Minecraft versions every installed mod has a
// build for) plus the scan's own progress. loader, mc_version and
// mods_signature describe the server the answer was computed FOR - when any of
// them no longer matches, the report is stale and nothing may act on it. The progress columns live here
// rather than in services/tasks.js because tasks are in-memory only - a panel
// restart mid-scan would otherwise leave the page with a spinner that never
// resolves and no way to resume. payload_json holds the partial result too, so
// a page refresh (or a restart) mid-scan renders what is already known.
//
// content_identity caches "these exact bytes are project X on platform Y",
// keyed on the file's own sha256 - never on its name, which repeats across
// projects. Hashing a jar is cheap next to a registry round trip, so a scan
// re-hashes what it finds and only pays the registries for bytes it has never
// seen (the filename and size are kept for support questions, not for lookup).
//
// project_support caches a project's (loader, Minecraft version) support matrix
// so a resumed or repeated scan re-asks the registries for nothing it already
// knows. Kept for a day - a project publishing a new build is exactly what a
// re-scan is looking for.

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS version_compat (
      server_id     TEXT PRIMARY KEY,
      loader        TEXT,
      mc_version    TEXT,
      mods_signature TEXT,
      status        TEXT NOT NULL DEFAULT 'idle',
      phase         TEXT,
      done          INTEGER NOT NULL DEFAULT 0,
      total         INTEGER NOT NULL DEFAULT 0,
      cursor        TEXT,
      error         TEXT,
      payload_json  TEXT,
      started_at    TEXT,
      updated_at    TEXT,
      completed_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS content_identity (
      sha256      TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      size        INTEGER NOT NULL DEFAULT 0,
      platform    TEXT,
      project_id  TEXT,
      name        TEXT,
      version     TEXT,
      checked_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_support (
      platform     TEXT NOT NULL,
      project_id   TEXT NOT NULL,
      name         TEXT,
      support_json TEXT NOT NULL,
      checked_at   TEXT NOT NULL,
      PRIMARY KEY (platform, project_id)
    );
  `);
}

module.exports = { up };
