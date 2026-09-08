'use strict';

// Perf-audit indexes. The relevant audit findings:
//
//   * events: listEvents / the Activity- and History-page queries filter by
//     server/type but ORDER BY id DESC + OFFSET. The existing
//     idx_events_server(server_id, created_at DESC) was built for the watcher's
//     time-window checks, so every paged list sorted by id forced a temp
//     B-tree. Cover the three real list shapes with id-ordered composites.
//     Write cost is irrelevant here: events receives a few thousand inserts a
//     day while pages render far more reads.
//   * crash_reports: the dashboard unread badge is COUNT(*) WHERE server_id = ?
//     AND viewed = 0 (no index - a per-server scan), and the History page
//     orders by file_mtime DESC. Both covered below. crash_reports is a
//     low-write table so two extra indexes are cheap.
//   * player_events: the daily prune runs DELETE ... WHERE ts < ? on the
//     largest table with NO ts-only index (only server-scoped composites), a
//     full scan that stalled every request for the duration.

function up(db) {
  db.exec(`
    CREATE INDEX idx_events_server_id ON events(server_id, id DESC);
    CREATE INDEX idx_events_server_type_id ON events(server_id, type, id DESC);
    CREATE INDEX idx_events_type_id ON events(type, id DESC);

    CREATE INDEX idx_crash_server_viewed ON crash_reports(server_id, viewed);
    CREATE INDEX idx_crash_server_mtime ON crash_reports(server_id, file_mtime DESC);

    CREATE INDEX idx_pevents_ts ON player_events(ts);
  `);
}

module.exports = { up };
