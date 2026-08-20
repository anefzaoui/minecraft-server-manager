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

router.post(
  '/totp/setup',
  asyncHandler(async (req, res) => {
    const { secret, otpauthUrl } = authService.beginTotpEnrollment(req.user.id);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    res.json({ ok: true, secret, otpauthUrl, qrDataUrl });
  })
);

router.post(
  '/totp/confirm',
  asyncHandler((req, res) => {
    const { secret, code } = z
      .object({ secret: z.string().min(16).max(64), code: z.string().trim().min(1).max(16) })
      .parse(req.body);
    const { backupCodes } = authService.confirmTotp(req.user.id, secret, code, { actor: req.user.username });
    res.json({ ok: true, backupCodes });
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
