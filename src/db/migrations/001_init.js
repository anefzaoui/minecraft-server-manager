'use strict';

// Initial schema. Conventions: TEXT ids (nanoid/slugs), ISO-8601 UTC datetimes,
// JSON columns suffixed _json, sizes in bytes, memory in MB.

function up(db) {
  db.exec(`
    CREATE TABLE users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','operator','viewer')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE user_server_permissions (
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id TEXT NOT NULL,
      perms     TEXT NOT NULL DEFAULT 'view',
      PRIMARY KEY (user_id, server_id)
    );

    CREATE TABLE sessions (
      sid        TEXT PRIMARY KEY,
      data_json  TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX idx_sessions_expires ON sessions(expires_at);

    -- Global panel settings + encrypted third-party API keys
    CREATE TABLE settings (
      key   TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
    CREATE TABLE api_keys (
      provider     TEXT PRIMARY KEY,          -- 'curseforge', ...
      key_cipher   TEXT NOT NULL,             -- AES-256-GCM: iv:tag:ciphertext (base64)
      added_at     TEXT NOT NULL DEFAULT (datetime('now')),
      last_tested_at TEXT,
      last_test_ok INTEGER
    );

    CREATE TABLE servers (
      id            TEXT PRIMARY KEY,          -- immutable slug (srv_xxxx)
      display_name  TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      icon          TEXT NOT NULL DEFAULT 'grass',   -- bundled name or library icon id
      accent        TEXT NOT NULL DEFAULT '#3fa62b',
      tags_json     TEXT NOT NULL DEFAULT '[]',
      notes         TEXT NOT NULL DEFAULT '',        -- admin-only scratchpad

      type          TEXT NOT NULL,             -- itzg TYPE (PAPER, FABRIC, AUTO_CURSEFORGE, ...)
      mc_version    TEXT NOT NULL DEFAULT 'LATEST',
      java_tag      TEXT NOT NULL DEFAULT '',   -- image tag; '' = auto from matrix
      env_json      TEXT NOT NULL DEFAULT '{}', -- catalog-managed + extra env vars

      port_game     INTEGER NOT NULL,
      port_rcon     INTEGER NOT NULL,
      port_query    INTEGER,
      port_bedrock  INTEGER,
      rcon_password_cipher TEXT NOT NULL,

      heap_mb              INTEGER NOT NULL,
      container_memory_mb  INTEGER NOT NULL,
      container_swap_mb    INTEGER NOT NULL DEFAULT 0,
      cpus                 REAL NOT NULL DEFAULT 0,   -- 0 = unlimited
      disk_quota_bytes     INTEGER NOT NULL DEFAULT 0, -- 0 = off
      quota_strict         INTEGER NOT NULL DEFAULT 0,

      update_policy TEXT NOT NULL DEFAULT 'manual' CHECK (update_policy IN ('manual','notify','auto')),
      auto_start    INTEGER NOT NULL DEFAULT 0,
      auto_restart  INTEGER NOT NULL DEFAULT 1,

      container_id  TEXT,
      pending_recreate INTEGER NOT NULL DEFAULT 0,   -- env/resources changed since last create
      status        TEXT NOT NULL DEFAULT 'stopped', -- cached last-known panel status
      last_started_at TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at    TEXT
    );

    -- Full action history. details_json carries structured payload incl. diffs.
    CREATE TABLE events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id   TEXT,                        -- NULL = panel-global event
      actor       TEXT NOT NULL,               -- username | 'system' | 'scheduler'
      type        TEXT NOT NULL,
      summary     TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      log_excerpt_path TEXT,                   -- relative to DATA_DIR when captured
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_events_server ON events(server_id, created_at DESC);
    CREATE INDEX idx_events_type ON events(type);
    CREATE INDEX idx_events_created ON events(created_at DESC);

    CREATE TABLE crash_reports (
      id          TEXT PRIMARY KEY,
      server_id   TEXT NOT NULL,
      filename    TEXT NOT NULL,
      file_mtime  TEXT NOT NULL,
      size_bytes  INTEGER NOT NULL,
      summary     TEXT NOT NULL DEFAULT '',
      exception   TEXT NOT NULL DEFAULT '',
      suspected_json TEXT NOT NULL DEFAULT '[]',
      event_id    INTEGER REFERENCES events(id),
      viewed      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (server_id, filename)
    );

    -- Shared file library (mods, plugins, datapacks, resourcepacks, modpacks,
    -- worlds, icons). Deduplicated by sha256.
    CREATE TABLE library_files (
      id          TEXT PRIMARY KEY,
      category    TEXT NOT NULL CHECK (category IN
                    ('mod','plugin','datapack','resourcepack','modpack','world','icon')),
      name        TEXT NOT NULL,
      filename    TEXT NOT NULL,
      rel_path    TEXT NOT NULL,               -- under DATA_DIR
      sha256      TEXT NOT NULL,
      size_bytes  INTEGER NOT NULL,
      source_url  TEXT,
      platform    TEXT,                        -- 'modrinth' | 'curseforge' | 'url' | 'upload'
      project_id  TEXT,
      file_id     TEXT,
      version     TEXT,
      mc_versions_json TEXT NOT NULL DEFAULT '[]',
      loaders_json     TEXT NOT NULL DEFAULT '[]',
      icon_url         TEXT,                    -- platform CDN icon (Modrinth icon_url / CF logo.url)
      icon_rel_path    TEXT,                    -- locally cached copy under library/icons/mods/
      -- world-specific metadata
      world_source     TEXT,                   -- 'upload' | 'extract:<server_id>' | 'import'
      world_flavor     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_library_sha ON library_files(sha256);
    CREATE INDEX idx_library_cat ON library_files(category);

    -- Content installed on a server. Pack-managed rows are discovered from the
    -- installer manifest; overlay rows reference the library.
    CREATE TABLE server_content (
      id           TEXT PRIMARY KEY,
      server_id    TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      library_id   TEXT REFERENCES library_files(id),
      kind         TEXT NOT NULL CHECK (kind IN ('mod','plugin','datapack','resourcepack')),
      managed_by   TEXT NOT NULL CHECK (managed_by IN ('pack','overlay')),
      name         TEXT NOT NULL,
      filename     TEXT NOT NULL,
      version      TEXT,
      icon_url     TEXT,                        -- for pack-managed rows with no library ref
      icon_rel_path TEXT,
      enabled      INTEGER NOT NULL DEFAULT 1,
      installed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (server_id, filename)
    );

    -- One row per server describing its (pinned) modpack, when it has one.
    CREATE TABLE server_packs (
      server_id     TEXT PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
      platform      TEXT NOT NULL,             -- 'curseforge' | 'modrinth' | 'ftb'
      project_ref   TEXT NOT NULL,             -- slug/id/url as user supplied
      project_name  TEXT NOT NULL,
      pinned_version_id TEXT NOT NULL,
      pinned_version_name TEXT NOT NULL,
      previous_version_id TEXT,
      previous_version_name TEXT,
      installed_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE update_checks (
      subject_type TEXT NOT NULL,              -- 'pack' | 'content' | 'image'
      subject_id   TEXT NOT NULL,              -- server_id | server_content.id | image tag
      current_version TEXT NOT NULL,
      latest_version  TEXT,
      latest_name     TEXT,
      changelog_url   TEXT,
      checked_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (subject_type, subject_id)
    );

    CREATE TABLE backups (
      id         TEXT PRIMARY KEY,
      server_id  TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      rel_path   TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256     TEXT,
      reason     TEXT NOT NULL CHECK (reason IN ('manual','scheduled','pre-update')),
      note       TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_backups_server ON backups(server_id, created_at DESC);

    CREATE TABLE schedules (
      id         TEXT PRIMARY KEY,
      server_id  TEXT REFERENCES servers(id) ON DELETE CASCADE,  -- NULL = global
      task_type  TEXT NOT NULL,               -- 'restart'|'backup'|'rcon'|'update-check'|...
      cron       TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      enabled    INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE blueprints (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      filename   TEXT NOT NULL,
      rel_path   TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      builtin    INTEGER NOT NULL DEFAULT 0,
      manifest_json TEXT NOT NULL,             -- cached copy of manifest.json
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Size-indexer cache + growth snapshots
    CREATE TABLE storage_index (
      rel_path   TEXT PRIMARY KEY,             -- directory path under DATA_DIR
      size_bytes INTEGER NOT NULL,
      file_count INTEGER NOT NULL,
      scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE storage_snapshots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      total_bytes INTEGER NOT NULL,
      per_server_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cached Mojang version manifest + other API caches
    CREATE TABLE api_cache (
      key        TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { up };
