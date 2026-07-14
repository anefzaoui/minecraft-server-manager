'use strict';

const { z } = require('zod');
const multer = require('multer');

/**
 * Map known infrastructure errors to a user-safe message, or null if the error
 * isn't recognized (callers redact unrecognized 5xx rather than leaking internals).
 */
function friendlyError(err) {
  const msg = err.message || 'Unexpected error';
  if (err.code === 'ENOENT' || /connect ENOENT|EACCES.*docker/i.test(msg)) {
    return 'Docker is not reachable. Is Docker running?';
  }
  if (/port is already allocated/i.test(msg)) return 'That port is already taken by another container.';
  if (/No such image/i.test(msg))
    return 'The server image is missing — it will be pulled automatically on the next start.';
  return null;
}

/**
 * Build a JSON error handler for an API router. Handles zod validation errors,
 * multer upload-limit errors (message via opts.fileTooLarge), maps known
 * infrastructure errors to friendly text, and — crucially — never leaks raw
 * internal error text (SQLite messages, absolute paths) on an unexpected 5xx.
 */
function makeJsonErrorHandler(tag, { fileTooLarge = 'File too large' } = {}) {
  // Express recognizes an error handler by its 4-arg signature (next unused).
  return function jsonErrorHandler(err, req, res, next) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: err.issues.map((i) => i.message).join('; ') });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? fileTooLarge : err.message });
    }
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(`[${tag}]`, err);
    const friendly = friendlyError(err);
    if (friendly) return res.status(status).json({ ok: false, error: friendly });
    if (status >= 500)
      return res.status(status).json({ ok: false, error: 'Unexpected server error — check the panel logs.' });
    return res.status(status).json({ ok: false, error: err.message || 'Unexpected error' });
  };
}

module.exports = { makeJsonErrorHandler, friendlyError };
