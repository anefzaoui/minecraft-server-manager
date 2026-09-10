'use strict';

const crypto = require('node:crypto');
const config = require('../../config');

// A small set of security response headers - the defense-in-depth a public,
// self-hosted panel should ship by default. Kept as a hand-rolled middleware
// rather than pulling in `helmet`, since it's a handful of static headers.
//
// Notes:
//  - X-Frame-Options: SAMEORIGIN (not DENY) + frame-ancestors 'self' stop other
//    sites from clickjacking the panel, while still allowing the panel to embed
//    its own same-origin BlueMap iframe.
//  - script-src uses a per-request nonce instead of 'unsafe-inline': the panel's
//    only inline <script> blocks (the theme-flash guard in both layouts, and the
//    panelLocalization data-island in main.hbs) carry `nonce="{{cspNonce}}"`,
//    and the handful of former inline `onerror=` icon-fallback attributes were
//    moved to a single delegated listener in app.js (inline event-handler
//    attributes are governed by script-src too, and a nonce on <script> doesn't
//    cover them). That closes off script-based DOM XSS as a CSP bypass.
//  - style-src keeps 'unsafe-inline': many views use dynamic inline style=""
//    for computed values (progress-bar widths, accent-color swatches). CSS
//    injection is far lower severity than script injection, and converting
//    every one of those to CSS custom properties is a materially larger,
//    higher-regression-risk change than the residual risk justifies.
//  - img-src allows blob: so the client-side profile-picture cropper
//    (public/js/lib/imageCrop.js) can preview the chosen image and its
//    downscaled canvas output via URL.createObjectURL. blob: URLs are minted
//    by the page from data it already holds - they can't reference anything
//    cross-origin - so this widens nothing an attacker could use.
function securityHeaders(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "frame-src 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}'`,
    "connect-src 'self'",
    "font-src 'self'",
  ].join('; ');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', csp);
  // Only assert HSTS when the panel is genuinely served over HTTPS - sending it
  // on plain HTTP would make browsers refuse a later HTTP-only deployment.
  if (config.cookieSecure === true || (config.cookieSecure === 'auto' && req.secure)) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

module.exports = { securityHeaders };
