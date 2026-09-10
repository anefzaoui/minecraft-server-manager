'use strict';

// NO-OP (kept so the migration version number stays stable).
//
// This migration originally ran:
//   DELETE FROM server_content
//     WHERE managed_by = 'overlay' AND kind IN ('datapack','resourcepack')
//       AND lower(filename) LIKE '%.jar'
// to drop "mod-wrapped .jar" rows that the old add-by-URL flow could resolve for
// a Modrinth datapack project. In practice that delete was too blunt: it also
// removed rows for .jar datapacks that were installed and enabled on Fabric
// servers, and - because it left the file on disk - turned each into an
// unlabelled orphan row (no icon, no name, no version, "file" badge) that looked
// more broken than the phantom it replaced.
//
// The bad-resolve is now prevented at install time (installFromUrl /
// pickDownloadFile filter datapack/resourcepack sources to a real .zip and
// reject a direct .jar URL), and listContent() adopts any remaining orphaned
// custom file from its library_files match, so no cleanup delete is needed here.

function up() {
  // intentionally empty
}

module.exports = { up };
