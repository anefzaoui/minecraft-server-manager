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

// A client-supplied request id is echoed into a response header, so it must be
// header-safe: a CR/LF in it would make res.setHeader throw ERR_INVALID_CHAR and
// turn every such request into a 500. Anything that isn't a short, plain token is
// dropped in favour of a fresh UUID.
const SAFE_REQUEST_ID = /^[\w.-]{1,128}$/;

function shouldSkip(pathname) {
  if (SKIP_EXACT.has(pathname)) return true;
  return SKIP_PREFIX.some((p) => pathname.startsWith(p));
}

function resolveRequestId(raw) {
  return typeof raw === 'string' && SAFE_REQUEST_ID.test(raw) ? raw : randomUUID();
}

module.exports = function requestLog(req, res, next) {
  if (shouldSkip(req.path)) return next();

  const start = process.hrtime.bigint();
  const requestId = resolveRequestId(req.headers['x-request-id']);
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  let logged = false;
  const emit = (aborted) => {
    if (logged) return;
    logged = true;
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
      aborted: aborted || undefined,
    };
    const level = aborted || status >= 500 ? 'warn' : status === 404 || status === 401 ? 'debug' : 'info';
    logger[level](aborted ? 'A request was aborted before it finished.' : 'Handled a request.', meta);
  };

  // 'finish' = response fully flushed; 'close' without 'finish' = client hung up.
  res.on('finish', () => emit(false));
  res.on('close', () => emit(!res.writableFinished));

  next();
};
