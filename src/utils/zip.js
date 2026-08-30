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
function extractZipSafe(zipFile, destDir, { map } = {}) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry) => {
        if (!safeEntryName(entry.fileName)) {
          zip.close();
          return reject(new Error(`Archive entry escapes destination: ${entry.fileName}`));
        }
        const isDir = /\/$/.test(entry.fileName);
        const mapped = map ? map(entry.fileName) : entry.fileName;
        if (mapped == null || mapped === '') return zip.readEntry();
        if (!safeEntryName(mapped)) {
          zip.close();
          return reject(new Error(`Archive entry escapes destination: ${entry.fileName}`));
        }
        const target = path.resolve(destDir, mapped);
        if (target !== path.resolve(destDir) && !target.startsWith(path.resolve(destDir) + path.sep)) {
          zip.close();
          return reject(new Error(`Archive entry escapes destination: ${entry.fileName}`));
        }
        if (isDir) {
          fs.mkdirSync(target, { recursive: true });
          zip.readEntry();
        } else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          zip.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return reject(streamErr);
            const out = fs.createWriteStream(target);
            out.on('close', () => zip.readEntry());
            out.on('error', reject);
            readStream.pipe(out);
          });
        }
      });
      zip.readEntry();
    });
  });
}

module.exports = { safeEntryName, readZipIndex, readEntryBuffers, extractZipSafe };
