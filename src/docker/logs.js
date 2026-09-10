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
 * timestamp events independently of the container's TZ). Pass `since` (Unix
 * seconds) to only return lines emitted at/after that time - e.g. to read just
 * the current boot's output from a reused container.
 * @param {string} serverId
 * @param {{ tail?: number, timestamps?: boolean, since?: number }} [opts]
 */
async function fetchLogs(serverId, { tail = 500, timestamps = false, since } = {}) {
  try {
    const opts = {
      stdout: true,
      stderr: true,
      tail,
      timestamps,
      ...(Number.isFinite(since) && since > 0 ? { since: Math.floor(since) } : {}),
    };
    const buf = await getContainer(serverId).logs(opts);
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

// Absolute ceiling on a single demultiplexed log frame. Docker frames carry a
// uint32 length from the container's stdout/stderr stream - a noisy or hostile
// container could declare a huge size and force a large subarray/join. Real
// Minecraft console lines never approach this (even a full stack trace or config
// dump is a few KB), so clamp oversized frames rather than materialize them.
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

/** Docker multiplexed log buffer → plain text (strips 8-byte frame headers). */
function demuxBuffer(buf) {
  if (!Buffer.isBuffer(buf)) return String(buf);
  const parts = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const type = buf[offset];
    if (type !== 0 && type !== 1 && type !== 2) {
      // Not framed (TTY container) - return as-is from here.
      parts.push(buf.subarray(offset).toString('utf8'));
      break;
    }
    const size = buf.readUInt32BE(offset + 4);
    if (size > MAX_FRAME_BYTES || offset + 8 + size > buf.length) {
      // Declared size is absurd or runs past the buffer - drop the frame and
      // stop rather than allocate over a huge logical range (subarray clamps,
      // but the join would still be unbounded). Reached only on malformed input.
      break;
    }
    parts.push(buf.subarray(offset + 8, offset + 8 + size).toString('utf8'));
    offset += 8 + size;
  }
  return parts.join('');
}

module.exports = { fetchLogs, followLogs, demuxBuffer };
