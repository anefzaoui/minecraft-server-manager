'use strict';

// First-run setup, login, logout.

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { z } = require('zod');
const authService = require('../../services/auth');
const { checkLoginAllowed, recordLoginFailure, clearLoginFailures } = require('../middleware/auth');
const { recordEvent } = require('../../events');
const config = require('../../config');
const { checkDocker } = require('../../docker/connect');
const logger = require('../../logger')('auth');
const { serializeError } = require('../../utils/logSanitize');

const router = express.Router();

// "Remember me" checked (the default): a long-lived cookie, refreshed on
// activity (rolling: true in the session middleware). Unchecked: a real
// browser-session cookie (cookie.expires = false - no Max-Age/Expires sent),
// gone the moment the browser closes.
const REMEMBER_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
function applyRememberCookie(req, remember) {
  if (remember) {
    req.session.cookie.maxAge = REMEMBER_MAX_AGE_MS;
    // rolling:true calls resetMaxAge() on every request, which copies
    // originalMaxAge back onto maxAge. Set it explicitly so the 30-day window is
    // preserved rather than silently reset to the 7-day session-middleware
    // default on the next request.
    req.session.cookie.originalMaxAge = REMEMBER_MAX_AGE_MS;
  } else {
    req.session.cookie.expires = false;
    req.session.cookie.originalMaxAge = null; // pure browser-session cookie, no rolling extension
  }
}

/**
 * First-run environment checks for the onboarding wizard. Levels: 'pass' (green),
 * 'warn' (amber, can proceed - e.g. Docker down / weak secret), 'fail' (red,
 * something is genuinely broken). Booleans only for the secret - the value never leaves.
 */
async function buildSetupChecks() {
  const docker = await checkDocker();

  const maj = Number(process.versions.node.split('.')[0]);
  const nodeOk = maj >= 24;

  let dataWritable;
  try {
    const probe = path.join(config.dataDir, `.wtest-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    dataWritable = true;
  } catch {
    dataWritable = false;
  }

  const secretSet = Boolean(config.sessionSecret);
  const secretStrong = secretSet && config.sessionSecret.length >= 16 && !/^change-me/i.test(config.sessionSecret);

  return {
    docker: {
      level: docker.available ? 'pass' : 'warn', // panel works without Docker; lifecycle features just wait
      available: docker.available,
      version: docker.version,
      os: docker.os,
      ncpu: docker.ncpu,
      memTotal: docker.memTotal,
      installed: docker.installed,
      isDockerDesktop: docker.isDockerDesktop,
      error: docker.error,
    },
    node: { level: nodeOk ? 'pass' : 'warn', version: process.versions.node, required: '24.0.0' },
    dataDir: { level: dataWritable ? 'pass' : 'fail', path: config.dataDir },
    sessionSecret: { level: secretStrong ? 'pass' : 'warn', set: secretSet, weak: secretSet && !secretStrong },
  };
}

router.get('/setup', (req, res) => {
  if (!authService.firstRunNeeded()) return res.redirect('/login');
  res.render('setup', { title: 'Welcome', layout: 'bare', needsPin: require('../../services/setupGate').required() });
});

// First-run only, so it can't be used to fingerprint the host after setup.
router.get('/setup/checks', async (req, res) => {
  if (!authService.firstRunNeeded())
    return res.status(403).json({ ok: false, error: 'First-run setup is already complete.' });
  try {
    res.json({ ok: true, checks: await buildSetupChecks() });
  } catch (err) {
    logger.error('The first-run environment checks could not be run.', { err: serializeError(err) });
    res.status(500).json({ ok: false, error: 'The environment checks could not be run.' });
  }
});

router.post('/setup', async (req, res) => {
  const wantsJson = req.xhr || String(req.headers.accept || '').includes('application/json');
  try {
    if (!authService.firstRunNeeded()) {
      return wantsJson
        ? res.status(409).json({ ok: false, error: 'First-run setup is already complete.' })
        : res.redirect('/login');
    }
    const { username, password, pin } = z
      .object({
        username: z
          .string()
          .trim()
          .min(2, 'Choose a username with at least 2 characters.')
          .max(32, 'That username is too long (32 characters max).'),
        password: z
          .string()
          .min(8, 'Choose a password with at least 8 characters.')
          .max(200, 'That password is too long (200 characters max).'),
        pin: z.string().max(12).optional(),
      })
      .parse(req.body);
    // On an exposed bind, the admin claim needs the PIN printed to the console.
    if (!require('../../services/setupGate').check(pin)) {
      const msg = 'That setup PIN is wrong. Check the panel’s console output for the 6-digit PIN.';
      return wantsJson
        ? res.status(403).json({ ok: false, error: msg })
        : res.status(403).render('setup', { title: 'Welcome', layout: 'bare', needsPin: true, error: msg });
    }
    const user = await authService.createUser({ username, password, role: 'admin' }, { actor: 'setup' });
    // Rotate the session id on privilege establishment (anti-fixation), matching login.
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed during first-run setup.', { err: serializeError(err) });
        return wantsJson
          ? res.status(500).json({ ok: false, error: 'Something went wrong starting your session. Please try again.' })
          : res.status(500).render('setup', {
              title: 'Welcome',
              layout: 'bare',
              error: 'Something went wrong starting your session. Please try again.',
            });
      }
      req.session.userId = user.id;
      // The operator just set the panel up - keep them signed in (30-day
      // rolling), same as ticking "remember me" on the login form.
      applyRememberCookie(req, true);
      recordEvent({
        actor: username,
        type: 'login',
        summary: `First admin account created and signed in: ${username}`,
      });
      logger.info('Created the first administrator account.', { userId: user.id, username });
      return wantsJson ? res.json({ ok: true, user: { username: user.username } }) : res.redirect('/');
    });
  } catch (err) {
    logger.warn('A first-run setup request was rejected.', {
      status: err.status || 400,
      err: serializeError(err, { includeStack: !err.status }),
    });
    if (wantsJson) return res.status(err.status || 400).json({ ok: false, error: firstIssue(err) });
    res.status(err.status || 400).render('setup', {
      title: 'Welcome',
      layout: 'bare',
      needsPin: require('../../services/setupGate').required(),
      error: firstIssue(err),
    });
  }
});

router.get('/login', (req, res) => {
  if (authService.firstRunNeeded()) return res.redirect('/setup');
  if (req.session && req.session.userId) return res.redirect('/');
  // A fresh visit to /login abandons any in-progress 2FA challenge rather than
  // leaving it dangling - re-entering credentials should start clean.
  if (req.session) {
    delete req.session.pendingTotpUserId;
    delete req.session.pendingTotpUsername;
    delete req.session.pendingTotpNext;
    delete req.session.pendingRemember;
  }
  res.render('login', { title: 'Sign In', layout: 'bare', next: safeNext(req.query.next) });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, next, remember } = z
      .object({
        username: z.string().trim().min(1, 'Enter your username.').max(64, 'Enter your username.'),
        password: z.string().min(1, 'Enter your password.').max(200, 'Enter your password.'),
        next: z.string().max(300).optional(),
        remember: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    checkLoginAllowed(username, req.ip);
    const user = await authService.verifyCredentials(username, password);
    if (!user) {
      recordLoginFailure(username, req.ip);
      logger.warn('Rejected a login with a bad username or password.', { username, ip: req.ip });
      return res.status(401).render('login', {
        title: 'Sign In',
        layout: 'bare',
        error: 'Wrong username or password.',
        next: safeNext(next),
      });
    }
    if (user.totpEnabled) {
      // Password alone does not authenticate - session.userId stays unset, so
      // requireAuth still treats this session as signed out. Deliberately does
      // NOT clear the login-failure counter yet: it stays shared with the 2FA
      // code step below, so a correct password can't be used to reset the
      // lockout right before brute-forcing the 6-digit code.
      req.session.pendingTotpUserId = user.id;
      req.session.pendingTotpUsername = user.username;
      req.session.pendingTotpNext = safeNext(next);
      req.session.pendingRemember = Boolean(remember);
      logger.debug('A login password was accepted; awaiting a two-factor code.', { userId: user.id, ip: req.ip });
      return res.redirect('/login/2fa');
    }
    clearLoginFailures(username, req.ip);
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed during login.', { username, err: serializeError(err) });
        return res.status(500).render('login', {
          title: 'Sign In',
          layout: 'bare',
          error: 'Something went wrong starting your session. Please try again.',
        });
      }
      req.session.userId = user.id;
      applyRememberCookie(req, Boolean(remember));
      recordEvent({ actor: user.username, type: 'login', summary: `${user.username} signed in` });
      logger.info('Signed a user in.', { userId: user.id, username: user.username, ip: req.ip, via: 'password' });
      res.redirect(safeNext(next) || '/');
    });
  } catch (err) {
    logger.warn('A login request was rejected.', { status: err.status || 400, ip: req.ip });
    res.status(err.status || 400).render('login', { title: 'Sign In', layout: 'bare', error: firstIssue(err) });
  }
});

router.get('/login/2fa', (req, res) => {
  if (!req.session || !req.session.pendingTotpUserId) return res.redirect('/login');
  res.render('login-2fa', { title: "Verify It's You", layout: 'bare' });
});

router.post('/login/2fa', async (req, res) => {
  const pendingId = req.session && req.session.pendingTotpUserId;
  const pendingUsername = req.session && req.session.pendingTotpUsername;
  if (!pendingId) return res.redirect('/login');
  try {
    const { code } = z.object({ code: z.string().trim().min(1).max(64) }).parse(req.body);
    checkLoginAllowed(pendingUsername, req.ip);
    const ok = await authService.verifyTotpLogin(pendingId, code);
    if (!ok) {
      recordLoginFailure(pendingUsername, req.ip);
      logger.warn('Rejected a login with a bad two-factor code.', { username: pendingUsername, ip: req.ip });
      return res
        .status(401)
        .render('login-2fa', { title: "Verify It's You", layout: 'bare', error: 'Incorrect code.' });
    }
    clearLoginFailures(pendingUsername, req.ip);
    const next = req.session.pendingTotpNext;
    const remember = req.session.pendingRemember;
    delete req.session.pendingTotpUserId;
    delete req.session.pendingTotpUsername;
    delete req.session.pendingTotpNext;
    delete req.session.pendingRemember;
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed during two-factor login.', {
          username: pendingUsername,
          err: serializeError(err),
        });
        return res.status(500).render('login-2fa', {
          title: "Verify It's You",
          layout: 'bare',
          error: 'Something went wrong starting your session. Please try again.',
        });
      }
      req.session.userId = pendingId;
      applyRememberCookie(req, Boolean(remember));
      recordEvent({ actor: pendingUsername, type: 'login', summary: `${pendingUsername} signed in (2FA)` });
      logger.info('Signed a user in.', {
        userId: pendingId,
        username: pendingUsername,
        ip: req.ip,
        via: 'password+2fa',
      });
      res.redirect(safeNext(next) || '/');
    });
  } catch (err) {
    logger.warn('A two-factor login request was rejected.', {
      username: pendingUsername,
      status: err.status || 400,
      ip: req.ip,
    });
    res
      .status(err.status || 400)
      .render('login-2fa', { title: "Verify It's You", layout: 'bare', error: firstIssue(err) });
  }
});

router.post('/logout', (req, res) => {
  // This route is mounted before requireAuth, so req.user is never populated
  // here - resolve the name from the session's own userId instead.
  const uid = req.session && req.session.userId;
  const name = (uid && authService.getUser(uid)?.username) || 'unknown';
  req.session.destroy(() => {
    res.clearCookie('msm.sid', {
      path: '/',
      httpOnly: true,
      sameSite: config.cookieSameSite,
      secure: config.cookieSecure === true,
    });
    recordEvent({ actor: name, type: 'logout', summary: `${name} signed out` });
    logger.info('Signed a user out.', { userId: uid });
    res.redirect('/login');
  });
});

function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/')) return '';
  // Reject protocol-relative ("//host"), backslash tricks ("/\\host" - browsers
  // normalize \ to / making it "//host"), and any whitespace/control chars.
  if (next.startsWith('//') || /[\\\s\x00-\x1f]/.test(next)) return '';
  return next;
}

function firstIssue(err) {
  if (err && err.issues && err.issues[0]) {
    const m = err.issues[0].message;
    // Zod's built-in messages are developer text - fall back to a plain sentence
    // rather than show them. Zod 4 rewrote the size/type wording ("Too small:",
    // "Too big:", "Invalid input:") so both the v3 and v4 prefixes are filtered.
    if (m && !/^(String|Number|Required|Invalid input|Expected|Too small|Too big|Invalid)/.test(m)) return m;
    return 'Please check what you entered and try again.';
  }
  // A deliberate, already-friendly error from the auth service or the rate
  // limiter (the 429 lockout notice, "That username is already taken.") carries
  // a .status - show its message rather than burying it under the generic line.
  if (err && err.status && typeof err.message === 'string' && err.message) return err.message;
  return 'Please check what you entered and try again.';
}

module.exports = router;
