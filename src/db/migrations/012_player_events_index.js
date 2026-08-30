'use strict';

// Two hot ingest-path lookups on player_events had no covering index, so they
// fell back to a full/partial scan that gets worse as history accumulates:
//   - the join/leave dedupe check (analytics/ingest.js insertEvent): latest
//     event for one (server_id, player), ordered by id.
//   - the log-backfill duplicate check (analytics/ingest.js backfillFromLogs):
//     exact (server_id, ts, raw) existence check before inserting a line.

function up(db) {
  db.exec(`
    CREATE INDEX idx_pevents_server_player_id ON player_events(server_id, player, id DESC);
    CREATE INDEX idx_pevents_backfill_dupe ON player_events(server_id, ts, raw);
  `);
}

module.exports = { up };
