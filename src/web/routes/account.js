'use strict';

// Self-service account security - two-factor auth. Mounted ahead of
// requireWrite (see web/app.js) so every role, including viewer, can protect
// their OWN account; nothing here ever reads or writes another user's row.

const fsp = require('node:fs/promises');
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const { checkLoginAllowed, recordLoginFailure, clearLoginFailures } = require('../middleware/auth');
const { dataPath } = require('../../storage/pathGuard');
const { AVATAR_PRESETS } = require('../../config/avatars');
const authService = require('../../services/auth');
const avatarStore = require('../../services/avatarStore');
const { matchesImageType, imageDimensions } = require('../../utils/sniffImage');
const { sanitizeSvg } = require('../../utils/svgSanitize');
const logger = require('../../logger')('account');
const { serializeError } = require('../../utils/logSanitize');

const router = express.Router();

// Small per-account sliding-window throttle, reused below for anything that
// persists nothing sensitive but still costs real work per call (QR rastering,
// disk writes) - without a cap, any authenticated session (a read-only viewer
// included) could loop one of these to pin the event loop or hammer disk I/O
// on a small self-hosted box. Each bucket gets its own independent window.
const hits = new Map(); // `${bucket}:${userId}` -> timestamps (ms) within the window
function throttle(bucket, userId, max, windowMs, nowMs = Date.now()) {
  const key = `${bucket}:${userId}`;
  const recent = (hits.get(key) || []).filter((t) => nowMs - t < windowMs);
  recent.push(nowMs);
  hits.set(key, recent);
  // Opportunistic cleanup: drop buckets whose every entry has aged out, so a
  // long-lived session pounding distinct bucket/user keys can't grow the map
  // without bound. Bounded by the number of distinct (bucket,user) pairs.
  if (recent.length === 1 && hits.size > 10_000) {
    for (const [k, ts] of hits) {
      if (!ts.some((t) => nowMs - t < windowMs)) hits.delete(k);
    }
  }
  return recent.length <= max;
}

// Generous for a human fumbling enrollment (scan, cancel, switch app, retry),
// but any per-minute cap defeats the event-loop DoS this guards against - a
// tight abuse loop would need orders of magnitude more than this.
const SETUP_WINDOW_MS = 60_000;
const SETUP_MAX = 20;

router.post(
  '/totp/setup',
  asyncHandler(async (req, res) => {
    if (!throttle('totp-setup', req.user.id, SETUP_MAX, SETUP_WINDOW_MS)) {
      logger.warn('Throttled a two-factor setup request.', { userId: req.user.id });
      return res.status(429).json({ ok: false, error: 'Too many 2FA setup attempts. Wait a minute and try again.' });
    }
    const { secret, otpauthUrl } = authService.beginTotpEnrollment(req.user.id);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    res.json({ ok: true, secret, otpauthUrl, qrDataUrl });
  })
);

// Enabling 2FA re-checks the account password (confirmTotp), so it gets the same
// shared login lockout as disable/regenerate below - a hijacked session can't use
// the password-compare here as an unthrottled brute-force oracle.
router.post(
  '/totp/confirm',
  asyncHandler(async (req, res) => {
    const { secret, code, password } = z
      .object({
        secret: z.string().min(16).max(64),
        code: z.string().trim().min(1).max(16),
        password: z.string().min(1).max(200),
      })
      .parse(req.body);
    checkLoginAllowed(req.user.username, req.ip);
    let result;
    try {
      result = await authService.confirmTotp(req.user.id, secret, code, password, {
        actor: req.user.username,
        exceptSid: req.sessionID,
      });
    } catch (err) {
      if (err.status === 401) {
        recordLoginFailure(req.user.username, req.ip);
        logger.warn('Rejected a two-factor confirmation with a bad password.', { userId: req.user.id, ip: req.ip });
      }
      throw err;
    }
    clearLoginFailures(req.user.username, req.ip);
    logger.info('Enabled two-factor authentication.', { userId: req.user.id });
    res.json({ ok: true, backupCodes: result.backupCodes });
  })
);

// Both routes below re-check the account's own password - same lockout the
// login form gets, keyed on this account (not IP alone), so a hijacked
// session can't use the password-compare here as an unthrottled oracle to
// brute-force the real password (bcrypt's cost alone isn't a hard stop).

router.post(
  '/totp/disable',
  asyncHandler(async (req, res) => {
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    checkLoginAllowed(req.user.username, req.ip);
    try {
      await authService.disableTotp(req.user.id, password, { actor: req.user.username, exceptSid: req.sessionID });
    } catch (err) {
      if (err.status === 401) {
        recordLoginFailure(req.user.username, req.ip);
        logger.warn('Rejected a two-factor disable with a bad password.', { userId: req.user.id, ip: req.ip });
      }
      throw err;
    }
    clearLoginFailures(req.user.username, req.ip);
    logger.info('Disabled two-factor authentication.', { userId: req.user.id });
    res.json({ ok: true });
  })
);

router.post(
  '/totp/backup-codes/regenerate',
  asyncHandler(async (req, res) => {
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    checkLoginAllowed(req.user.username, req.ip);
    let result;
    try {
      result = await authService.regenerateBackupCodes(req.user.id, password, {
        actor: req.user.username,
        exceptSid: req.sessionID,
      });
    } catch (err) {
      if (err.status === 401) {
        recordLoginFailure(req.user.username, req.ip);
        logger.warn('Rejected a backup-code regeneration with a bad password.', { userId: req.user.id, ip: req.ip });
      }
      throw err;
    }
    clearLoginFailures(req.user.username, req.ip);
    logger.info('Regenerated two-factor backup codes.', { userId: req.user.id });
    res.json({ ok: true, backupCodes: result.backupCodes });
  })
);

// ---------------------------------------------------------------------------
// Profile picture: a built-in preset (12 choices) or an uploaded image.
// Self-service only - own account, any role, same as everything above.

router.get('/avatar/presets', (req, res) => {
  res.json({
    ok: true,
    presets: AVATAR_PRESETS.map((p) => ({ key: p.key, label: p.label, url: `/icons/avatars/${p.file}` })),
  });
});

// Generous for someone clicking through presets to see how they look, but
// unbounded was a gap: nothing else stopped a hijacked session from looping
// this (or the upload below) to churn disk writes indefinitely.
const AVATAR_WINDOW_MS = 60_000;
const AVATAR_MAX = 30;

// Runs BEFORE multer on the upload route, so a throttled caller is turned away
// before the multipart body is parsed and written to disk - not after.
function avatarWriteThrottle(req, res, next) {
  if (!throttle('avatar-write', req.user.id, AVATAR_MAX, AVATAR_WINDOW_MS)) {
    logger.warn('Throttled a profile picture change.', { userId: req.user.id });
    return res.status(429).json({ ok: false, error: 'Too many avatar changes. Wait a minute and try again.' });
  }
  next();
}

router.post(
  '/avatar/preset',
  avatarWriteThrottle,
  asyncHandler(async (req, res) => {
    const { key } = z.object({ key: z.string().min(1).max(32) }).parse(req.body);
    authService.setAvatarPreset(req.user.id, key, { actor: req.user.username });
    // Switching to a preset abandons any prior upload - delete it rather than
    // leave it orphaned on disk and still fetchable by its stable URL.
    await avatarStore.removeAvatarFiles(req.user.id);
    logger.info('Set a profile picture preset.', { userId: req.user.id, preset: key });
    res.json({ ok: true, avatar: `preset:${key}` });
  })
);

// Same limits and accepted types as the server-icon upload (api.js) - kept
// identical rather than inventing a second convention for "an icon image".
const AVATAR_MAX_BYTES = 16 * 1024 * 1024;
const AVATAR_TOO_LARGE = 'That image is too large (max 16 MB).';
// Header-declared pixel bound: a valid-header raster claiming e.g. 40000x40000
// still decompresses in every admin's user list. There is no server-side image
// library here, so cap dimensions from the header before anything renders it.
const MAX_AVATAR_DIMENSION = 8192;
const avatarUpload = multer({ dest: dataPath('tmp'), limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } });

router.post(
  '/avatar/upload',
  avatarWriteThrottle,
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res, next) => {
    let consumed = false;
    try {
      if (!req.file) throw Object.assign(new Error('Attach an image (field "avatar")'), { status: 400 });
      const ext = avatarStore.AVATAR_EXTS[req.file.mimetype];
      if (!ext) {
        throw Object.assign(new Error('Profile pictures must be PNG, JPEG, WebP, or SVG (max 16 MB).'), {
          status: 400,
        });
      }
      if (!(await matchesImageType(req.file.path, req.file.mimetype))) {
        logger.warn('Rejected a profile picture upload whose bytes do not match its declared type.', {
          userId: req.user.id,
          declared: req.file.mimetype,
        });
        throw Object.assign(new Error("File contents don't match the declared image type"), { status: 400 });
      }
      if (req.file.mimetype === 'image/svg+xml') {
        // Scrub scripting / external refs out of a raw SVG before it lands on
        // disk (defence in depth behind the sandbox CSP the serving route sets).
        const clean = sanitizeSvg(await fsp.readFile(req.file.path, 'utf8'));
        if (!/<svg[\s>]/i.test(clean)) {
          throw Object.assign(new Error('That SVG could not be processed safely'), { status: 400 });
        }
        await fsp.writeFile(req.file.path, clean, 'utf8');
      } else {
        const dims = await imageDimensions(req.file.path, req.file.mimetype);
        if (dims && (dims.width > MAX_AVATAR_DIMENSION || dims.height > MAX_AVATAR_DIMENSION)) {
          throw Object.assign(
            new Error(`Image is too large in pixels (max ${MAX_AVATAR_DIMENSION}x${MAX_AVATAR_DIMENSION})`),
            { status: 400 }
          );
        }
      }
      const filename = await avatarStore.storeUpload({ userId: req.user.id, tmpPath: req.file.path, ext });
      consumed = true;
      authService.setAvatarCustom(req.user.id, filename, { actor: req.user.username });
      logger.info('Uploaded a custom profile picture.', { userId: req.user.id });
      res.json({ ok: true, avatar: `custom:${filename}`, url: `/api/avatars/custom/${filename}` });
    } catch (err) {
      if (req.file && !consumed) {
        await fsp.rm(req.file.path, { force: true }).catch((e) => {
          logger.debug('Could not remove a temporary upload file.', {
            err: serializeError(e, { includeStack: false }),
          });
        });
      }
      next(err);
    }
  })
);

router.delete(
  '/avatar',
  asyncHandler(async (req, res) => {
    authService.clearAvatar(req.user.id, { actor: req.user.username });
    await avatarStore.removeAvatarFiles(req.user.id);
    logger.info('Cleared a profile picture.', { userId: req.user.id });
    res.json({ ok: true });
  })
);

router.use(makeJsonErrorHandler('account', { fileTooLarge: AVATAR_TOO_LARGE }));

module.exports = router;
