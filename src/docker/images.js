// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Image management: ensure-pulled with progress, and digest comparison for
// "image update available" checks.

const { getDocker } = require('./connect');
const config = require('../config');

// Overridable via MC_IMAGE_REPO for a private mirror / air-gapped registry.
const IMAGE_REPO = config.mcImageRepo;

function imageRef(javaTag) {
  return javaTag ? `${IMAGE_REPO}:${javaTag}` : `${IMAGE_REPO}:latest`;
}

async function imageExists(ref) {
  try {
    await getDocker().getImage(ref).inspect();
    return true;
  } catch (err) {
    if (err.statusCode === 404) return false;
    throw err;
  }
}

/**
 * Pull an image, invoking onProgress({status, layers, done}) as layers move.
 * Resolves when the pull completes.
 */
function pullImage(ref, onProgress = () => {}) {
  const docker = getDocker();
  return new Promise((resolve, reject) => {
    docker.pull(ref, (err, stream) => {
      if (err) return reject(err);
      const layers = new Map();
      docker.modem.followProgress(
        stream,
        (doneErr) => (doneErr ? reject(doneErr) : resolve()),
        (evt) => {
          if (evt.id && evt.progressDetail) layers.set(evt.id, evt.progressDetail);
          let current = 0;
          let total = 0;
          for (const d of layers.values()) {
            current += d.current || 0;
            total += d.total || 0;
          }
          onProgress({ status: evt.status || '', current, total });
        }
      );
    });
  });
}

async function ensureImage(ref, onProgress) {
  if (!(await imageExists(ref))) await pullImage(ref, onProgress);
}

/** Local digest for update comparison (RepoDigests sha). */
async function localDigest(ref) {
  try {
    const info = await getDocker().getImage(ref).inspect();
    const rd = info.RepoDigests && info.RepoDigests[0];
    return rd ? rd.split('@')[1] : null;
  } catch {
    return null;
  }
}

module.exports = { IMAGE_REPO, imageRef, imageExists, pullImage, ensureImage, localDigest };
