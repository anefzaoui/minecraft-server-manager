'use strict';

// Runs the actual zip compression for a backup off the main thread. archiver
// streams from disk, but the zlib deflate + directory-walk framing still burn
// main-thread CPU on a large modded world; here they burn a worker's instead,
// so the panel stays responsive mid-backup.
//
// Messages back to the parent: {type:'progress', processedBytes} repeatedly,
// then exactly one of {type:'done'} / {type:'error', message}.

const fs = require('node:fs');
const { parentPort, workerData } = require('node:worker_threads');
const archiver = require('archiver');

const { sourceDir, outFile } = workerData;

let settled = false;
const finish = (msg) => {
  if (settled) return;
  settled = true;
  parentPort.postMessage(msg);
};

const output = fs.createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 6 } });

const fail = (err) => {
  if (settled) return;
  // Drop the half-written archive so a repeatedly failing scheduled backup can't
  // leak fds / orphan partial files.
  try {
    output.destroy();
  } catch {
    /* already gone */
  }
  fs.rm(outFile, { force: true }, () =>
    finish({ type: 'error', message: err && err.message ? err.message : String(err) })
  );
};

output.on('close', () => finish({ type: 'done' }));
output.on('error', fail);
archive.on('error', fail);
archive.on('progress', (d) => {
  if (!settled) parentPort.postMessage({ type: 'progress', processedBytes: d.fs.processedBytes });
});

archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
