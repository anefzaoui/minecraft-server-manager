'use strict';

// A small set of security response headers — the defense-in-depth a public,
// self-hosted panel should ship by default. Kept as a hand-rolled middleware
// rather than pulling in `helmet`, since it's a handful of static headers.
//
// Notes:
//  - X-Frame-Options: SAMEORIGIN (not DENY) + frame-ancestors 'self' stop other
//    sites from clickjacking the panel, while still allowing the panel to embed
//    its own same-origin BlueMap iframe.
//  - The CSP allows 'unsafe-inline' for scripts/styles because pages ship inline
//    <script> data-islands and inline styles; it still constrains object-src,
//    base-uri, and form-action. Moving to nonces is a future hardening step.

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "frame-src 'self'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "font-src 'self'",
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', CSP);
  next();
}

module.exports = { securityHeaders };
