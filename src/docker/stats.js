'use strict';

// Live container stats for dashboards/metrics. One-shot and streaming forms;
// numbers normalized to { cpuPct, memUsedBytes, memLimitBytes, netRx, netTx }.

const { getContainer } = require('./containers');

function normalize(stats) {
  // CPU % per Docker's documented formula.
  let cpuPct = 0;
  try {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const online = stats.cpu_stats.online_cpus || (stats.cpu_stats.cpu_usage.percpu_usage || []).length || 1;
    if (sysDelta > 0 && cpuDelta > 0) cpuPct = (cpuDelta / sysDelta) * online * 100;
  } catch {
    /* fields absent on some platforms until second sample */
  }

  const mem = stats.memory_stats || {};
  // Subtract page cache where reported so numbers match `docker stats`.
  const cache = (mem.stats && (mem.stats.inactive_file ?? mem.stats.cache)) || 0;
  const memUsed = Math.max(0, (mem.usage || 0) - cache);

  let netRx = 0;
  let netTx = 0;
  for (const nic of Object.values(stats.networks || {})) {
    netRx += nic.rx_bytes || 0;
    netTx += nic.tx_bytes || 0;
  }
  return {
    cpuPct: Math.round(cpuPct * 10) / 10,
    memUsedBytes: memUsed,
    memLimitBytes: mem.limit || 0,
    netRx,
    netTx,
  };
}

async function statsOnce(serverId) {
  try {
    const stats = await getContainer(serverId).stats({ stream: false });
    return normalize(stats);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 409) return null;
    throw err;
  }
}

/** Stream stats; onSample(normalized) per tick. Returns stop(). */
async function statsStream(serverId, onSample) {
  const raw = await getContainer(serverId).stats({ stream: true });
  let buffer = '';
  // Without this, a container removal mid-stream emits an unhandled 'error'
  // event that would crash the whole panel process.
  raw.on('error', () => {
    /* consumer notices via silence; stop() cleans up */
  });
  raw.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        onSample(normalize(JSON.parse(line)));
      } catch {
        /* partial frame */
      }
    }
  });
  return () => {
    try {
      raw.destroy();
    } catch {
      /* closed */
    }
  };
}

module.exports = { statsOnce, statsStream, normalize };
