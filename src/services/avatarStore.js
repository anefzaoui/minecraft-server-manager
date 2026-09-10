'use strict';

// On-disk layout for uploaded profile pictures. web/routes/account.js validates
// the upload (size via multer, byte-sniff, dimensions) and then hands the temp
// file here; this module owns where it lands and how it is swapped in/removed.
//
// Kept out of services/auth.js so that module stays free of filesystem coupling
// (its avatar helpers only touch the users.avatar marker column - see the note
// there); the route layer calls removeAvatarFiles() alongside clearAvatar() /
// setAvatarPreset() / deleteUser() so a "removed" picture is actually gone from
// disk, not just orphaned and still downloadable.

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { dataPath } = require('../storage/pathGuard');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

// mimetype -> stored extension. Shared shape with the server-icon upload in
// web/routes/api.js (kept in step deliberately - "an icon image" is one concept).
const AVATAR_EXTS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const ALL_EXTS = [...new Set(Object.values(AVATAR_EXTS))];

// User ids are `usr_` + nanoid; anything outside this set can't be a real id and
// must never reach path.join (a `../` id would escape the avatar directory).
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function avatarDir() {
  return dataPath('library', 'icons', 'users');
}

function avatarFilename(userId, ext) {
  return `${userId}${ext}`;
}

async function quietRm(target) {
  await fsp.rm(target, { force: true }).catch((e) => {
    logger.debug('Could not remove a profile-picture file.', {
      err: serializeError(e, { includeStack: false }),
    });
  });
}

/**
 * Move a validated temp upload into place as this user's avatar and drop any
 * previous variant. The swap onto the final path is a single rename (atomic on
 * the destination filesystem), staged through a sibling temp name so a
 * concurrent GET never sees a missing or half-written file. Returns the stored
 * filename (e.g. `usr_ab12cd34.png`).
 */
async function storeUpload({ userId, tmpPath, ext }) {
  if (!SAFE_ID.test(String(userId))) throw new Error(`Refusing to store an avatar for an unexpected id: ${userId}`);
  const dir = avatarDir();
  await fsp.mkdir(dir, { recursive: true });

  const finalName = avatarFilename(userId, ext);
  const finalPath = path.join(dir, finalName);
  const stagePath = path.join(dir, `.tmp-${userId}-${crypto.randomBytes(6).toString('hex')}${ext}`);

  try {
    // Prefer a rename off the multer temp dir; fall back to copy for a
    // cross-device (EXDEV) temp dir.
    await fsp.rename(tmpPath, stagePath).catch(async () => {
      await fsp.copyFile(tmpPath, stagePath);
      await quietRm(tmpPath);
    });
    await fsp.rename(stagePath, finalPath);
  } catch (err) {
    await quietRm(stagePath);
    await quietRm(tmpPath);
    throw err;
  }

  // New file is already in place; now retire stale other-extension variants.
  for (const other of ALL_EXTS) {
    if (other !== ext) await quietRm(path.join(dir, avatarFilename(userId, other)));
  }
  return finalName;
}

/** Delete every stored avatar file for a user (all extensions). No-op if none. */
async function removeAvatarFiles(userId) {
  if (!userId || !SAFE_ID.test(String(userId))) return;
  const dir = avatarDir();
  for (const ext of ALL_EXTS) {
    await quietRm(path.join(dir, avatarFilename(userId, ext)));
  }
}

module.exports = { AVATAR_EXTS, avatarDir, storeUpload, removeAvatarFiles };
