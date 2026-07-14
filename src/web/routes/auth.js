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

const router = express.Router();

/**
 * First-run environment checks for the onboarding wizard. Levels: 'pass' (green),
 * 'warn' (amber, can proceed — e.g. Docker down / weak secret), 'fail' (red,
 * something is genuinely broken). Booleans only for the secret — the value never leaves.
 */
async function buildSetupChecks() {
  const docker = await checkDocker();

  const maj = Number(process.versions.node.split('.')[0]);
  const nodeOk = maj >= 24;

  let dataWritable = false;
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
  res.render('setup', { title: 'Welcome', layout: 'bare' });
});

// First-run only, so it can't be used to fingerprint the host after setup.
router.get('/setup/checks', async (req, res) => {
  if (!authService.firstRunNeeded()) return res.status(403).json({ ok: false, error: 'Setup already complete' });
  try {
    res.json({ ok: true, checks: await buildSetupChecks() });
  } catch {
    res.status(500).json({ ok: false, error: 'Could not run environment checks' });
  }
});

router.post('/setup', (req, res) => {
  const wantsJson = req.xhr || String(req.headers.accept || '').includes('application/json');
  try {
    if (!authService.firstRunNeeded()) {
      return wantsJson ? res.status(409).json({ ok: false, error: 'Setup already complete' }) : res.redirect('/login');
    }
    const { username, password } = z
      .object({
        username: z.string().trim().min(2).max(32),
        password: z.string().min(8).max(200),
      })
      .parse(req.body);
    const user = authService.createUser({ username, password, role: 'admin' }, { actor: 'setup' });
    // Rotate the session id on privilege establishment (anti-fixation), matching login.
    req.session.regenerate((err) => {
      if (err) {
        return wantsJson
          ? res.status(500).json({ ok: false, error: 'Session error — try again.' })
          : res.status(500).render('setup', { title: 'Welcome', layout: 'bare', error: 'Session error — try again.' });
      }
      req.session.userId = user.id;
      recordEvent({
        actor: username,
        type: 'login',
        summary: `First admin account created and signed in: ${username}`,
      });
      return wantsJson ? res.json({ ok: true, user: { username: user.username } }) : res.redirect('/');
    });
  } catch (err) {
    if (wantsJson) return res.status(err.status || 400).json({ ok: false, error: firstIssue(err) });
    res.status(err.status || 400).render('setup', { title: 'Welcome', layout: 'bare', error: firstIssue(err) });
  }
});

router.get('/login', (req, res) => {
  if (authService.firstRunNeeded()) return res.redirect('/setup');
  if (req.session && req.session.userId) return res.redirect('/');
  res.render('login', { title: 'Sign in', layout: 'bare', next: safeNext(req.query.next) });
});

router.post('/login', (req, res) => {
  try {
    const { username, password, next } = z
      .object({
        username: z.string().trim().min(1).max(64),
        password: z.string().min(1).max(200),
        next: z.string().max(300).optional(),
      })
      .parse(req.body);
    checkLoginAllowed(username, req.ip);
    const user = authService.verifyCredentials(username, password);
    if (!user) {
      recordLoginFailure(username, req.ip);
      return res.status(401).render('login', {
        title: 'Sign in',
        layout: 'bare',
        error: 'Wrong username or password.',
        next: safeNext(next),
      });
    }
    clearLoginFailures(username, req.ip);
    req.session.regenerate((err) => {
      if (err)
        return res
          .status(500)
          .render('login', { title: 'Sign in', layout: 'bare', error: 'Session error — try again.' });
      req.session.userId = user.id;
      recordEvent({ actor: user.username, type: 'login', summary: `${user.username} signed in` });
      res.redirect(safeNext(next) || '/');
    });
  } catch (err) {
    res.status(err.status || 400).render('login', { title: 'Sign in', layout: 'bare', error: firstIssue(err) });
  }
});

router.post('/logout', (req, res) => {
  const name = req.user ? req.user.username : 'unknown';
  req.session.destroy(() => {
    recordEvent({ actor: name, type: 'logout', summary: `${name} signed out` });
    res.redirect('/login');
  });
});

function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/')) return '';
  // Reject protocol-relative ("//host"), backslash tricks ("/\\host" — browsers
  // normalize \ to / making it "//host"), and any whitespace/control chars.
  if (next.startsWith('//') || /[\\\s\x00-\x1f]/.test(next)) return '';
  return next;
}

function firstIssue(err) {
  if (err && err.issues) return err.issues[0].message;
  return err.message || 'Something went wrong';
}

module.exports = router;
