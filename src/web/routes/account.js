'use strict';

// Self-service account security — two-factor auth. Mounted ahead of
// requireWrite (see web/app.js) so every role, including viewer, can protect
// their OWN account; nothing here ever reads or writes another user's row.

const express = require('express');
const QRCode = require('qrcode');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const { checkLoginAllowed, recordLoginFailure, clearLoginFailures } = require('../middleware/auth');
const authService = require('../../services/auth');

const router = express.Router();

// /totp/setup mints a fresh secret and rasters a QR on every call, persisting
// nothing — so throttle it per account. Without a cap, any authenticated session
// (a read-only viewer included) could loop it to pin the event loop on a small
// self-hosted box. A handful a minute is plenty for a real enrollment.
const setupHits = new Map(); // userId -> timestamps (ms) within the window
const SETUP_WINDOW_MS = 60_000;
// Generous for a human fumbling enrollment (scan, cancel, switch app, retry),
// but any per-minute cap defeats the event-loop DoS this guards against — a
// tight abuse loop would need orders of magnitude more than this.
const SETUP_MAX = 20;
function throttleSetup(userId, nowMs) {
  const recent = (setupHits.get(userId) || []).filter((t) => nowMs - t < SETUP_WINDOW_MS);
  recent.push(nowMs);
  setupHits.set(userId, recent);
  return recent.length <= SETUP_MAX;
}

router.post(
  '/totp/setup',
  asyncHandler(async (req, res) => {
    if (!throttleSetup(req.user.id, Date.now())) {
      return res.status(429).json({ ok: false, error: 'Too many 2FA setup attempts — wait a minute and try again.' });
    }
    const { secret, otpauthUrl } = authService.beginTotpEnrollment(req.user.id);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    res.json({ ok: true, secret, otpauthUrl, qrDataUrl });
  })
);

// Enabling 2FA re-checks the account password (confirmTotp), so it gets the same
// shared login lockout as disable/regenerate below — a hijacked session can't use
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

// Both routes below re-check the account's own password — same lockout the
// login form gets, keyed on this account (not IP alone), so a hijacked
// session can't use the password-compare here as an unthrottled oracle to
// brute-force the real password (bcrypt's cost alone isn't a hard stop).

router.post(
  '/totp/disable',
  asyncHandler((req, res) => {
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    checkLoginAllowed(req.user.username, req.ip);
    try {
      authService.disableTotp(req.user.id, password, { actor: req.user.username });
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
      result = authService.regenerateBackupCodes(req.user.id, password, { actor: req.user.username });
    } catch (err) {
      if (err.status === 401) recordLoginFailure(req.user.username, req.ip);
      throw err;
    }
    clearLoginFailures(req.user.username, req.ip);
    res.json({ ok: true, backupCodes: result.backupCodes });
  })
);

router.use(makeJsonErrorHandler('account'));

module.exports = router;
