'use strict';

// Container log access: bounded fetch for page loads + follow streams for the
// WebSocket console. itzg containers run without TTY, so output arrives in
// Docker's multiplexed framing and must be demuxed.

const { PassThrough } = require('node:stream');
const { getDocker } = require('./connect');
const { getContainer } = require('./containers');

/**
 * Fetch the last `tail` lines as a string. Pass `timestamps: true` to prefix
 * each line with Docker's RFC3339 receive time (used by analytics ingest to
 * timestamp events independently of the container's TZ).
 */
async function fetchLogs(serverId, { tail = 500, timestamps = false } = {}) {
  try {
    const buf = await getContainer(serverId).logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps,
    });
    return demuxBuffer(buf);
  } catch (err) {
    if (err.statusCode === 404) return '';
    throw err;
  }
}

/**
 * Follow logs from now on. Returns { stream, stop } where stream emits utf8
 * lines-ish chunks. Caller must stop() on WebSocket close.
 */
async function followLogs(serverId, { tail = 200, timestamps = false } = {}) {
  const container = getContainer(serverId);
  const raw = await container.logs({
    stdout: true,
    stderr: true,
    follow: true,
    tail,
    timestamps,
  });
  const out = new PassThrough();
  getDocker().modem.demuxStream(raw, out, out);
  raw.on('end', () => out.end());
  raw.on('error', () => out.end());
  return {
    stream: out,
    stop: () => {
      try {
        raw.destroy();
      } catch {
        /* already closed */
      }
    },
  };
}

/** Docker multiplexed log buffer → plain text (strips 8-byte frame headers). */
function demuxBuffer(buf) {
  if (!Buffer.isBuffer(buf)) return String(buf);
  const parts = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const type = buf[offset];
    if (type !== 0 && type !== 1 && type !== 2) {
      // Not framed (TTY container) — return as-is from here.
      parts.push(buf.subarray(offset).toString('utf8'));
      break;
    }
    const size = buf.readUInt32BE(offset + 4);
    parts.push(buf.subarray(offset + 8, offset + 8 + size).toString('utf8'));
    offset += 8 + size;
  }
  return parts.join('');
}

module.exports = { fetchLogs, followLogs, demuxBuffer };
