'use strict';

// mclo.gs sharing for crash reports: once a report is shared, remember the
// paste id + public URL so the History tab can link it and insights can be
// re-fetched without re-uploading.

function up(db) {
  db.exec(`
    ALTER TABLE crash_reports ADD COLUMN mclogs_id  TEXT;
    ALTER TABLE crash_reports ADD COLUMN mclogs_url TEXT;
  `);
}

module.exports = { up };
