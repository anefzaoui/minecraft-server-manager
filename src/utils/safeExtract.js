'use strict';

// One zip extractor for the whole panel. Backups (restore), the world library
// (uploaded / snapshotted worlds), and blueprint import all take an untrusted
// .zip and unpack it under a staging dir - each used to carry its own near-
// identical yauzl loop, so a hardening fix in one never reached the others.
// This is that loop, once:
//
//   - zip-slip: every entry name is rejected on NUL / backslash / absolute
//     path / drive letter / a `..` segment, AND the fully-resolved target is
//     re-checked to sit inside destDir (belt and braces).
//   - decompression bomb: the summed central-directory sizes AND the actual
//     streamed bytes are both capped, and so is the entry count.
//   - yauzl only ever writes regular files and directories (never a symlink),
//     so an in-archive symlink cannot redirect a later write out of destDir.
//
// Thrown errors carry `.status` (400 containment, 413 size/count) so the JSON
// error handlers surface them as client errors rather than a bare 500.

const fs = require('node:fs');
const path = require('node:path');
const yauzl = require('yauzl');

const MAX_EXTRACT_BYTES = 50 * 1024 ** 3;
const MAX_EXTRACT_ENTRIES = 200_000;

function err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** True when `name` is a safe relative path with no traversal / absolute / device parts. */
function safeEntryName(name) {
  if (!name || name.includes('\0') || name.includes('\\')) return false;
  if (path.isAbsolute(name) || /^[a-zA-Z]:/.test(name)) return false;
  return !name.split('/').includes('..');
}

/**
 * Extract every entry of `zipFile` under `destDir`. Resolves on success,
 * rejects (with a `.status`-tagged Error) on a containment violation or a
 * size/entry-count ceiling breach. `destDir` must already exist.
 */
function extractZip(zipFile, destDir, { maxBytes = MAX_EXTRACT_BYTES, maxEntries = MAX_EXTRACT_ENTRIES } = {}) {
  const root = path.resolve(destDir);
  /** @type {Promise<void>} */
  const p = new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (openErr, zip) => {
      if (openErr) return reject(err(400, 'Not a valid zip archive'));
      let settled = false;
      let entryCount = 0;
      let declaredBytes = 0;
      let writtenBytes = 0;

      const fail = (e) => {
        if (settled) return;
        settled = true;
        try {
          zip.destroy();
        } catch {
          /* already closed */
        }
        reject(e);
      };
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      zip.on('error', fail);
      zip.on('end', done);
      zip.on('entry', (entry) => {
        if (++entryCount > maxEntries) {
          return fail(err(413, `Archive has too many entries (> ${maxEntries}) - refusing to extract.`));
        }
        declaredBytes += entry.uncompressedSize || 0;
        if (declaredBytes > maxBytes) {
          return fail(
            err(
              413,
              `Archive is too large uncompressed (> ${Math.round(maxBytes / 1024 ** 3)} GB) - refusing to extract (possible decompression bomb).`
            )
          );
        }

        if (!safeEntryName(entry.fileName)) {
          return fail(err(400, `Archive entry escapes destination: ${entry.fileName}`));
        }
        const target = path.resolve(root, entry.fileName);
        if (target !== root && !target.startsWith(root + path.sep)) {
          return fail(err(400, `Archive entry escapes destination: ${entry.fileName}`));
        }

        if (/\/$/.test(entry.fileName)) {
          fs.mkdirSync(target, { recursive: true });
          zip.readEntry();
          return;
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        zip.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr) return fail(streamErr);
          const out = fs.createWriteStream(target);
          readStream.on('data', (chunk) => {
            writtenBytes += chunk.length;
            if (writtenBytes > maxBytes) {
              readStream.destroy();
              out.destroy();
              fail(
                err(
                  413,
                  `Archive exceeds the ${Math.round(maxBytes / 1024 ** 3)} GB extraction limit - aborted (possible decompression bomb).`
                )
              );
            }
          });
          out.on('close', () => {
            if (!settled) zip.readEntry();
          });
          out.on('error', fail);
          readStream.pipe(out);
        });
      });
      zip.readEntry();
    });
  });
  return p;
}

module.exports = { extractZip, safeEntryName, MAX_EXTRACT_BYTES, MAX_EXTRACT_ENTRIES };
