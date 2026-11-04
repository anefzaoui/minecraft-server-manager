'use strict';

// Per-user dismissals for the dashboard's health alerts (crashes, out-of-memory
// stops, auto-restarts). The alerts themselves are history events, which stay
// untouched: dismissing only hides one for that user. Rows cascade away with
// the user or when history pruning drops the event.

function up(db) {
  db.exec(`
    CREATE TABLE alert_dismissals (
      user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      dismissed_at TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, event_id)
    );
    CREATE INDEX idx_alert_dismissals_event ON alert_dismissals(event_id);
  `);
}

module.exports = { up };
