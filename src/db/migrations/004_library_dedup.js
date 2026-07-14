'use strict';

// Enforce library de-duplication at the DB level so the download check-then-insert
// can't race two identical files into two rows (which would share one on-disk file
// and break deletion). Collapse any pre-existing duplicates first, re-pointing
// server_content references to the surviving row, then add the UNIQUE index.

function up(db) {
  const dups = db.all(
    `SELECT sha256, category, MIN(id) AS keep, COUNT(*) AS n
       FROM library_files
      GROUP BY sha256, category
     HAVING n > 1`
  );
  for (const d of dups) {
    const losers = db
      .all('SELECT id FROM library_files WHERE sha256 = ? AND category = ? AND id <> ?', d.sha256, d.category, d.keep)
      .map((r) => r.id);
    for (const lid of losers) {
      db.run('UPDATE server_content SET library_id = ? WHERE library_id = ?', d.keep, lid);
      db.run('DELETE FROM library_files WHERE id = ?', lid);
    }
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uniq_library_sha_cat ON library_files(sha256, category)');
}

module.exports = { up };
