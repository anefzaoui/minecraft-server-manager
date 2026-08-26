'use strict';

// Self-service account security - two-factor auth. Mounted ahead of
// requireWrite (see web/app.js) so every role, including viewer, can protect
// their OWN account; nothing here ever reads or writes another user's row.

const fsp = require('node:fs/promises');
const path = require('node:path');
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
const { matchesImageType } = require('../../utils/sniffImage');

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
      return res.status(429).json({ ok: false, error: 'Too many 2FA setup attempts - wait a minute and try again.' });
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
  asyncHandler((req, res) => {
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
      result = authService.confirmTotp(req.user.id, secret, code, password, { actor: req.user.username });
    } catch (err) {
      if (err.status === 401) recordLoginFailure(req.user.username, req.ip);
      throw err;
    }
    clearLoginFailures(req.user.username, req.ip);
    res.json({ ok: true, backupCodes: result.backupCodes });
  })
);

// Both routes below re-check the account's own password - same lockout the
// login form gets, keyed on this account (not IP alone), so a hijacked
// session can't use the password-compare here as an unthrottled oracle to
// brute-force the real password (bcrypt's cost alone isn't a hard stop).

router.post(
  '/totp/disable',
  asyncHandler((req, res) => {
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    checkLoginAllowed(req.user.username, req.ip);
    try {
      authService.disableTotp(req.user.id, password, { actor: req.user.username, exceptSid: req.sessionID });
    } catch (err) {
      if (err.status === 401) recordLoginFailure(req.user.username, req.ip);
      throw err;
    }
    clearLoginFailures(req.user.username, req.ip);
    res.json({ ok: true });
  })
);

router.post(
  '/totp/backup-codes/regenerate',
  asyncHandler((req, res) => {
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    checkLoginAllowed(req.user.username, req.ip);
    let result;
    try {
      result = authService.regenerateBackupCodes(req.user.id, password, {
        actor: req.user.username,
        exceptSid: req.sessionID,
      });
    } catch (err) {
      if (err.status === 401) recordLoginFailure(req.user.username, req.ip);
      throw err;
    }
    clearLoginFailures(req.user.username, req.ip);
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

router.post(
  '/avatar/preset',
  asyncHandler((req, res) => {
    if (!throttle('avatar-write', req.user.id, AVATAR_MAX, AVATAR_WINDOW_MS)) {
      return res.status(429).json({ ok: false, error: 'Too many avatar changes - wait a minute and try again.' });
    }
    const { key } = z.object({ key: z.string().min(1).max(32) }).parse(req.body);
    authService.setAvatarPreset(req.user.id, key, { actor: req.user.username });
    res.json({ ok: true, avatar: `preset:${key}` });
  })
);

// Same limits and accepted types as the server-icon upload (api.js) - kept
// identical rather than inventing a second convention for "an icon image".
const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_EXTS = { 'image/png': '.png', 'image/svg+xml': '.svg', 'image/jpeg': '.jpg' };
const avatarUpload = multer({ dest: dataPath('tmp'), limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } });

router.post(
  '/avatar/upload',
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res, next) => {
    try {
      if (!throttle('avatar-write', req.user.id, AVATAR_MAX, AVATAR_WINDOW_MS)) {
        throw Object.assign(new Error('Too many avatar changes - wait a minute and try again.'), { status: 429 });
      }
      if (!req.file) throw Object.assign(new Error('Attach an image (field "avatar")'), { status: 400 });
      const ext = AVATAR_EXTS[req.file.mimetype];
      if (!ext) {
        throw Object.assign(new Error('Avatars must be PNG, SVG or JPEG (max 512 KB)'), { status: 400 });
      }
      if (!(await matchesImageType(req.file.path, req.file.mimetype))) {
        throw Object.assign(new Error("File contents don't match the declared image type"), { status: 400 });
      }
      const filename = `${req.user.id}${ext}`;
      const destDir = dataPath('library', 'icons', 'users');
      await fsp.mkdir(destDir, { recursive: true });
      // Drop stale variants with a different extension, same as server icons.
      for (const other of Object.values(AVATAR_EXTS)) {
        if (other !== ext) await fsp.rm(path.join(destDir, `${req.user.id}${other}`), { force: true }).catch(() => {});
      }
      await fsp.rm(path.join(destDir, filename), { force: true }).catch(() => {});
      await fsp.rename(req.file.path, path.join(destDir, filename)).catch(async () => {
        await fsp.copyFile(req.file.path, path.join(destDir, filename));
        await fsp.rm(req.file.path, { force: true });
      });
      authService.setAvatarCustom(req.user.id, filename, { actor: req.user.username });
      res.json({ ok: true, avatar: `custom:${filename}`, url: `/api/avatars/custom/${filename}` });
    } catch (err) {
      if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
      next(err);
    }
  })
);

router.delete(
  '/avatar',
  asyncHandler((req, res) => {
    authService.clearAvatar(req.user.id, { actor: req.user.username });
    res.json({ ok: true });
  })
);

router.use(makeJsonErrorHandler('account'));

module.exports = router;
