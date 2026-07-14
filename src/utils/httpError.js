'use strict';

/**
 * Build an Error carrying an HTTP status code. Services throw these; the JSON
 * error handler (see web/middleware/jsonErrorHandler.js) turns them into the
 * matching response status.
 */
module.exports = function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
};
