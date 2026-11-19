'use strict';

// Stubs node:http's request() so tests can fake an upstream HTTP response
// without a real socket. Needed because urlGuard.safeFetch pins its
// connection via node:http/node:https directly (not the global fetch()), so a
// plain `globalThis.fetch = ...` stub no longer intercepts it.

const http = require('node:http');
const { Readable } = require('node:stream');

/**
 * Replace http.request for the duration of a test. `handler({method, path,
 * headers, body})` (body: the written request body, as a Buffer) returns (or
 * resolves to) {status, headers, body} for the fake response. Returns a
 * restore function - call it in test.afterEach / a finally block.
 */
function stubHttpRequest(handler) {
  const real = http.request;
  http.request = (options, callback) => {
    const chunks = [];
    const req = {
      on() {
        return req;
      },
      write(chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      },
      end() {
        Promise.resolve(
          handler({
            method: options.method || 'GET',
            path: options.path,
            headers: options.headers || {},
            body: Buffer.concat(chunks),
          })
        ).then(({ status = 200, headers = {}, body = '' }) => {
          const res = Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(body)]);
          res.statusCode = status;
          res.headers = headers;
          callback(res);
        });
      },
    };
    return req;
  };
  return () => {
    http.request = real;
  };
}

module.exports = { stubHttpRequest };
