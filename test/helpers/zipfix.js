'use strict';

// Build zip fixtures (jars, modpack exports) for tests via archiver.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const archiver = require('archiver');

/** Write a zip at zipPath from {entryName: content} (Buffer|string). Dirs end with '/'. */
async function buildZip(zipPath, entries) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(zipPath);
    const zip = archiver('zip', { zlib: { level: 1 } });
    out.on('close', resolve);
    zip.on('error', reject);
    zip.pipe(out);
    for (const [name, content] of Object.entries(entries)) {
      if (name.endsWith('/')) zip.append(null, { name });
      else zip.append(typeof content === 'string' ? Buffer.from(content) : content, { name });
    }
    zip.finalize();
  });
  return zipPath;
}

/** Build a zip in a fresh temp dir and return its path. */
async function tempZip(name, entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-zipfix-'));
  return buildZip(path.join(dir, name), entries);
}

/** Build an in-memory jar (zip) buffer from {entryName: content}. */
async function jarBuffer(entries) {
  const zipPath = await tempZip(`jar-${Date.now()}-${Math.random().toString(36).slice(2)}.jar`, entries);
  const buf = fs.readFileSync(zipPath);
  fs.rmSync(path.dirname(zipPath), { recursive: true, force: true });
  return buf;
}

module.exports = { buildZip, tempZip, jarBuffer };
