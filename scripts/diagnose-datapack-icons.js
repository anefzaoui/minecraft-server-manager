'use strict';

// Read-only diagnosis for the "mod/datapack icons show the puzzle placeholder"
// bug. Prints the library_files / server_content rows that feed the Mods tab,
// then walks every content file on disk and explains why (or whether) it fails
// to resolve an icon in listContent().
//
//   node scripts/diagnose-datapack-icons.js [serverId]
//
// Nothing is written. Safe to run against a live data dir.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('../src/db');
const config = require('../src/config');

const onlyServer = (process.argv[2] || '').trim() || null;
const CONTENT_DIRS = ['world/datapacks', 'resourcepacks', 'mods', 'plugins'];

function stripExt(name) {
  return name.replace(/\.disabled$/, '').replace(/\.(jar|zip)$/i, '');
}

// mods/ and plugins/ share a pool (library_files.category is 'mod' or 'plugin'),
// so an exact-name hit there is fine whatever the recorded category.
function dirKind(dir) {
  if (dir === 'world/datapacks') return 'datapack';
  if (dir === 'resourcepacks') return 'resourcepack';
  return null;
}

function sha256File(abs) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  } catch {
    return null;
  }
}

function table(title, rows) {
  console.log(`\n=== ${title} (${rows.length}) ===`);
  if (rows.length) console.table(rows);
}

const libRows = db.all(
  `SELECT id, category, platform, name, filename, version, project_id,
          substr(icon_url, 1, 60) AS icon_url, icon_rel_path, sha256
   FROM library_files
   WHERE category IN ('mod','plugin','datapack','resourcepack')
   ORDER BY category, name`
);
table('library_files (content)', libRows);

// Flag cached-icon rows whose file is gone.
const missingIconFiles = libRows
  .filter((r) => r.icon_rel_path && !fs.existsSync(path.join(config.dataDir, r.icon_rel_path)))
  .map((r) => ({ id: r.id, name: r.name, icon_rel_path: r.icon_rel_path }));
if (missingIconFiles.length) {
  console.log('\n!!! icon_rel_path SET BUT FILE MISSING ON DISK !!!');
  console.table(missingIconFiles);
}

// Indexes mirroring the planned adoption logic.
const byExactName = new Map(libRows.map((r) => [r.filename, r]));
const byLowerName = new Map(libRows.map((r) => [r.filename.toLowerCase(), r]));
const bySha = new Map(libRows.filter((r) => r.sha256).map((r) => [r.sha256, r]));
const byStem = new Map();
for (const r of libRows) {
  const k = stripExt(r.filename).toLowerCase();
  if (!byStem.has(k)) byStem.set(k, []);
  byStem.get(k).push(r);
}

const servers = db
  .all('SELECT id, display_name, type FROM servers WHERE deleted_at IS NULL ORDER BY display_name')
  .filter((s) => !onlyServer || s.id === onlyServer);
table('servers', servers);

for (const server of servers) {
  const content = db.all(
    `SELECT kind, managed_by, library_id, filename, name, version,
            substr(icon_url, 1, 60) AS icon_url
     FROM server_content WHERE server_id = ? ORDER BY kind, filename`,
    server.id
  );
  table(`server_content — ${server.display_name} (${server.id})`, content);
  const rowByFile = new Map(content.map((r) => [r.filename.replace(/\.disabled$/, ''), r]));

  const findings = [];
  for (const dir of CONTENT_DIRS) {
    const abs = path.join(config.dataDir, 'servers', server.id, dir);
    let entries;
    try {
      entries = fs.readdirSync(abs);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const base = entry.replace(/\.disabled$/, '');
      if (!/\.(jar|zip)$/i.test(base)) continue;
      const row = rowByFile.get(base);
      const filePath = path.join(abs, entry);
      const sha = sha256File(filePath);
      const exact = byExactName.get(base);
      const lower = byLowerName.get(base.toLowerCase());
      const shaHit = sha ? bySha.get(sha) : null;
      const stemHits = byStem.get(stripExt(base).toLowerCase()) || [];

      const wantKind = dirKind(dir);
      let verdict;
      if (row && row.library_id) verdict = 'OK (row + library_id)';
      else if (row) verdict = 'HAS_ROW_BUT_NULL_LIB';
      else if (exact && (!wantKind || exact.category === wantKind)) verdict = 'OK (exact name)';
      else if (exact) verdict = `CATEGORY_MISMATCH(${exact.category})`;
      else if (shaHit) verdict = `FILENAME_MISMATCH(${shaHit.filename})`;
      else if (lower) verdict = 'CASE_MISMATCH';
      else if (stemHits.length === 1) verdict = `STEM_MATCH(${stemHits[0].filename})`;
      else if (stemHits.length > 1) verdict = 'STEM_AMBIGUOUS';
      else verdict = 'NO_LIBRARY_ROW';

      const match = row || exact || shaHit || lower || (stemHits.length === 1 ? stemHits[0] : null);
      findings.push({
        dir,
        file: base,
        row: row ? 'yes' : 'no',
        sha8: sha ? sha.slice(0, 8) : '(unreadable)',
        matchLib: match && match.id ? match.id : match ? '(server_content row)' : '-',
        iconState: match
          ? match.icon_rel_path
            ? 'cached'
            : match.icon_url
              ? 'remote-only'
              : match.project_id
                ? 'derivable(project_id)'
                : 'none'
          : '-',
        verdict,
      });
    }
  }
  table(`on-disk content verdicts — ${server.display_name}`, findings);
}
