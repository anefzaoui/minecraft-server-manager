'use strict';

// Parity features: activity timeline, sessions, analytics snapshots,
// integrations (Discord), and public status page flags.

function up(db) {
  db.exec(`
    -- Structured events parsed from server logs (chat, join, leave, death,
    -- advancement, pvp). Search uses indexed LIKE scans — node:sqlite (Node 23)
    -- ships without the FTS5 module.
    CREATE TABLE player_events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      ts        TEXT NOT NULL,                -- ISO from log line or ingest time
      type      TEXT NOT NULL,                -- chat|join|leave|death|advancement|pvp|command
      player    TEXT NOT NULL DEFAULT '',
      target    TEXT NOT NULL DEFAULT '',     -- pvp victim, death source, …
      message   TEXT NOT NULL DEFAULT '',     -- chat text / death message / advancement name
      raw       TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_pevents_server_ts ON player_events(server_id, ts DESC);
    CREATE INDEX idx_pevents_player ON player_events(player);
    CREATE INDEX idx_pevents_type ON player_events(type);

    -- Play sessions derived from join/leave events.
    CREATE TABLE player_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id  TEXT NOT NULL,
      player     TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at   TEXT,                        -- NULL = session open
      UNIQUE (server_id, player, started_at)
    );
    CREATE INDEX idx_sessions_player ON player_sessions(server_id, player, started_at DESC);

    -- Periodic snapshots of world/stats/<uuid>.json (deltas power the charts).
    CREATE TABLE player_stat_snapshots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id  TEXT NOT NULL,
      uuid       TEXT NOT NULL,
      name       TEXT NOT NULL DEFAULT '',
      ts         TEXT NOT NULL DEFAULT (datetime('now')),
      stats_json TEXT NOT NULL                -- curated flat {playtimeTicks, deaths, mobKills, playerKills, blocksMined, diamondsMined, ancientDebrisMined, stoneMined, distanceCm, damageDealt, damageTaken, jumps, …}
    );
    CREATE INDEX idx_statsnap ON player_stat_snapshots(server_id, uuid, ts DESC);

    -- Per-server integrations (Discord webhook/bot, public status page).
    CREATE TABLE integrations (
      server_id     TEXT NOT NULL,
      kind          TEXT NOT NULL,            -- 'discord-webhook' | 'discord-bot' | 'status-page'
      enabled       INTEGER NOT NULL DEFAULT 0,
      config_cipher TEXT,                     -- encrypted JSON (webhook url, bot token, …)
      config_json   TEXT NOT NULL DEFAULT '{}', -- non-secret config (event toggles, slug)
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (server_id, kind)
    );
  `);
}

module.exports = { up };
