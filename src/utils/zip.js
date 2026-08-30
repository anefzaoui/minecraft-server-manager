// @ts-nocheck — dynamic yauzl stream interop.
'use strict';

// Shared zip-slip-guarded zip reading/extraction helpers (yauzl-based).
// Used by blueprints import, the mods zip importer, and world/backup restores
// keep their own specialized variants.

const fs = require('node:fs');
const path = require('node:path');
const yauzl = require('yauzl');
const httpError = require('./httpError');

/** Entry names must be relative, forward-slashed, and free of dot-segments. */
function safeEntryName(name) {
  if (!name || name.includes('\0') || name.includes('\\')) return false;
  if (path.isAbsolute(name) || /^[a-zA-Z]:/.test(name)) return false;
  return !name.split('/').includes('..');
}

/**
 * List entries and stream out selected small text entries without extracting.
 * @param {string} zipPath
 * @param {{textEntry?: (name: string) => boolean, maxTextBytes?: number}} opts
 * @returns {Promise<{entries: {name, size}[], texts: Map<string, string>}>}
 */
function readZipIndex(zipPath, { textEntry, maxTextBytes = 20 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(httpError(400, 'Not a valid zip archive'));
      const entries = [];
      const texts = new Map();
      zip.on('error', reject);
      zip.on('end', () => resolve({ entries, texts }));
      zip.on('entry', (entry) => {
        if (!safeEntryName(entry.fileName)) {
          zip.close();
          return reject(httpError(400, `Archive entry escapes its destination: ${entry.fileName}`));
        }
        entries.push({ name: entry.fileName, size: entry.uncompressedSize });
        const wantText = textEntry && !/\/$/.test(entry.fileName) && textEntry(entry.fileName);
        if (wantText && entry.uncompressedSize <= maxTextBytes) {
          zip.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return reject(streamErr);
            const chunks = [];
            readStream.on('data', (c) => chunks.push(c));
            readStream.on('error', reject);
            readStream.on('end', () => {
              texts.set(entry.fileName, Buffer.concat(chunks).toString('utf8'));
              zip.readEntry();
            });
          });
        } else {
          zip.readEntry();
        }
      });
      zip.readEntry();
    });
  });
}

/**
 * Read selected entries fully into buffers (for hashing/inspection).
 * Enforces per-entry and total ceilings — a zip's headers can lie about
 * uncompressedSize, so the ceilings are enforced on the actual streamed bytes.
 * @param {string} zipPath
 * @param {(name: string) => boolean} select
 * @param {{maxEntryBytes?: number, maxTotalBytes?: number}} opts
 * @returns {Promise<Map<string, Buffer>>}
 */
function readEntryBuffers(zipPath, select, { maxEntryBytes = 512 * 1024 * 1024, maxTotalBytes = 4 * 1024 ** 3 } = {}) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(httpError(400, 'Not a valid zip archive'));
      const out = new Map();
      let total = 0;
      zip.on('error', reject);
      zip.on('end', () => resolve(out));
      zip.on('entry', (entry) => {
        if (!safeEntryName(entry.fileName)) {
          zip.close();
          return reject(httpError(400, `Archive entry escapes its destination: ${entry.fileName}`));
        }
        if (/\/$/.test(entry.fileName) || !select(entry.fileName)) return zip.readEntry();
        zip.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr) return reject(streamErr);
          const chunks = [];
          let size = 0;
          readStream.on('data', (c) => {
            size += c.length;
            total += c.length;
            if (size > maxEntryBytes || total > maxTotalBytes) {
              zip.close();
              return reject(httpError(413, 'Zip contents exceed the allowed size'));
            }
            chunks.push(c);
          });
          readStream.on('error', reject);
          readStream.on('end', () => {
            out.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

/**
 * Extract a zip under destDir; every entry path is containment-checked.
 * @param {string} zipFile
 * @param {string} destDir
 * @param {{map?: (name: string) => string | null}} opts
 *   map — rewrite an entry name to a different destination-relative path, or
 *   return null to skip the entry entirely (e.g. extract only overrides/).
 */
const MAX_EXTRACT_BYTES = 50 * 1024 ** 3;
const MAX_EXTRACT_ENTRIES = 200_000;

/**
 * Extract every entry of `zipFile` under `destDir` - the one extractor for the
 * whole panel (backup restore, world install, blueprint import, pack
 * overrides). Merges what used to be two near-identical loops:
 *
 *   - zip-slip: entry names (and mapped names) are rejected on NUL / backslash /
 *     absolute path / drive letter / a `..` segment, AND the fully-resolved
 *     target is re-checked to sit inside destDir.
 *   - decompression bomb: summed central-directory sizes AND the actual
 *     streamed bytes are both capped, and so is the entry count.
 *   - `map(fileName)` may rewrite an entry's relative destination or return
 *     null/'' to skip it (pack overrides use this).
 *   - yauzl only ever writes regular files and directories (never a symlink),
 *     so an in-archive symlink cannot redirect a later write out of destDir.
 *
 * Thrown errors carry `.status` (400 containment, 413 size/count) so the JSON
 * error handlers surface them as client errors rather than a bare 500.
 * `destDir` must already exist.
 */
function extractZipSafe(
  zipFile,
  destDir,
  { map, maxBytes = MAX_EXTRACT_BYTES, maxEntries = MAX_EXTRACT_ENTRIES } = {}
) {
  const root = path.resolve(destDir);
  return new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (openErr, zip) => {
      if (openErr) return reject(httpError(400, 'Not a valid zip archive'));
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
          return fail(httpError(413, `Archive has too many entries (> ${maxEntries}) - refusing to extract.`));
        }
        declaredBytes += entry.uncompressedSize || 0;
        if (declaredBytes > maxBytes) {
          return fail(
            httpError(
              413,
              `Archive is too large uncompressed (> ${Math.round(maxBytes / 1024 ** 3)} GB) - refusing to extract (possible decompression bomb).`
            )
          );
        }

        if (!safeEntryName(entry.fileName)) {
          return fail(httpError(400, `Archive entry escapes destination: ${entry.fileName}`));
        }
        const isDir = /\/$/.test(entry.fileName);
        const mapped = map ? map(entry.fileName) : entry.fileName;
        if (mapped == null || mapped === '') return zip.readEntry();
        if (!safeEntryName(mapped)) {
          return fail(httpError(400, `Archive entry escapes destination: ${entry.fileName}`));
        }
        const target = path.resolve(root, mapped);
        if (target !== root && !target.startsWith(root + path.sep)) {
          return fail(httpError(400, `Archive entry escapes destination: ${entry.fileName}`));
        }

        if (isDir) {
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
                httpError(
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
}

module.exports = {
  safeEntryName,
  readZipIndex,
  readEntryBuffers,
  extractZipSafe,
  // Compatibility name for callers of the former utils/safeExtract module.
  extractZip: extractZipSafe,
  MAX_EXTRACT_BYTES,
  MAX_EXTRACT_ENTRIES,
};
