'use strict';

// Access log. One line per request, emitted on `res` finish so it carries the
// final status and duration. Static assets and the health probe are skipped so
// the log stays signal. The 5xx line is logged at `warn` WITHOUT a stack - the
// JSON/HTML error handlers own the `error` line and the stack trace, so this one
// only records that a request ended badly.

const { randomUUID } = require('node:crypto');
const logger = require('../../logger')('http');

const SKIP_EXACT = new Set(['/healthz', '/favicon.ico']);
const SKIP_PREFIX = ['/css/', '/js/', '/fonts/', '/icons/', '/vendor/', '/assets/'];

function shouldSkip(pathname) {
  if (SKIP_EXACT.has(pathname)) return true;
  return SKIP_PREFIX.some((p) => pathname.startsWith(p));
}

module.exports = function requestLog(req, res, next) {
  if (shouldSkip(req.path)) return next();

  const start = process.hrtime.bigint();
  const requestId = String(req.headers['x-request-id'] || randomUUID());
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10;
    const status = res.statusCode;
    const meta = {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status,
      durationMs,
      requestId,
      userId: req.user ? req.user.id : undefined,
      ip: req.ip,
    };
    const level = status >= 500 ? 'warn' : status === 404 || status === 401 ? 'debug' : 'info';
    logger[level]('Handled a request.', meta);
  });

  next();
};
