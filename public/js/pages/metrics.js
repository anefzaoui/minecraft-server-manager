// Metrics ("Live") tab: the top stat strip and the CPU / memory / network /
// tick-rate charts, all fed by the stats WebSocket. Chart.js is loaded globally
// from /vendor/chart.umd.js by the partial.

const root = document.querySelector('[data-metrics-server]');
if (root && window.Chart)
  init(
    root.dataset.metricsServer,
    Number(root.dataset.metricsMemLimit) || 0,
    Number(root.dataset.metricsCpuLimit) || 0
  );

function init(serverId, memLimitMb, cpuLimit) {
  const MAX_POINTS = 60;

  // --- Top stat strip: keep the SSR numbers moving between reloads.
  const metricEl = (name) => root.querySelector(`[data-metric="${name}"]`);
  const tpsCard = root.querySelector('[data-tps-card]');
  let perfSupported = root.dataset.metricsPerfSupported === '1';

  // Local uptime ticker from the container's start time.
  const startedAt = root.dataset.metricsStartedAt ? Date.parse(root.dataset.metricsStartedAt) : null;
  function fmtUptime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    return `${m}m`;
  }
  if (startedAt) {
    const upEl = metricEl('uptime');
    const tick = () => upEl && (upEl.textContent = fmtUptime(Date.now() - startedAt));
    tick();
    setInterval(() => {
      if (!document.hidden) tick();
    }, 30000);
  }

  // Theme tokens, re-read on toggle: Chart.js paints on canvas, so it can't
  // follow CSS variables by itself.
  function themeColors() {
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--color-line').trim();
    return {
      grass: css.getPropertyValue('--color-grass-400').trim() || '#59c53e',
      diamond: css.getPropertyValue('--color-diamond-400').trim() || '#3cc5c7',
      gold: css.getPropertyValue('--color-gold-400').trim() || '#f0b42f',
      redstone: css.getPropertyValue('--color-redstone-400').trim() || '#e5484d',
      grid: line ? `${line}66` : 'rgba(128,128,128,.12)',
      tick: css.getPropertyValue('--color-ink-faint').trim() || '#87919b',
    };
  }
  let colors = themeColors();
  const charts = [];

  function makeChart(canvas, datasets, { max, unit, y1 } = {}) {
    if (!canvas) return null;
    const scales = {
      x: { display: false },
      y: {
        beginAtZero: true,
        suggestedMax: max,
        grid: { color: colors.grid },
        ticks: { callback: (v) => `${v}${unit || ''}`, color: colors.tick },
      },
    };
    if (y1)
      scales.y1 = {
        beginAtZero: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { callback: (v) => `${v}${y1}`, color: colors.tick },
      };
    const chart = new window.Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets },
      options: {
        responsive: true,
        animation: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: datasets.length > 1, labels: { boxWidth: 10, color: colors.tick } } },
        scales,
        elements: { point: { radius: 0 }, line: { borderWidth: 2, tension: 0.35 } },
      },
    });
    charts.push(chart);
    return chart;
  }

  new MutationObserver(() => {
    colors = themeColors();
    for (const chart of charts) {
      chart.options.scales.y.grid.color = colors.grid;
      chart.options.scales.y.ticks.color = colors.tick;
      if (chart.options.scales.y1) chart.options.scales.y1.ticks.color = colors.tick;
      if (chart.options.plugins.legend.labels) chart.options.plugins.legend.labels.color = colors.tick;
      chart.update('none');
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const cpuChart = makeChart(
    document.querySelector('[data-chart="cpu"]'),
    [{ label: 'CPU %', data: [], borderColor: colors.diamond, backgroundColor: 'transparent' }],
    { max: cpuLimit ? cpuLimit * 100 : 100, unit: '%' }
  );
  const memChart = makeChart(
    document.querySelector('[data-chart="memory"]'),
    [{ label: 'Used MB', data: [], borderColor: colors.grass, backgroundColor: 'transparent' }],
    { max: memLimitMb || undefined, unit: ' MB' }
  );
  const netChart = makeChart(
    document.querySelector('[data-chart="network"]'),
    [
      { label: 'RX KB/s', data: [], borderColor: colors.diamond, backgroundColor: 'transparent' },
      { label: 'TX KB/s', data: [], borderColor: colors.gold, backgroundColor: 'transparent' },
    ],
    { unit: '' }
  );
  const tpsChart = makeChart(
    document.querySelector('[data-chart="tps"]'),
    [
      { label: 'TPS', data: [], borderColor: colors.grass, backgroundColor: 'transparent', yAxisID: 'y' },
      { label: 'ms/tick', data: [], borderColor: colors.redstone, backgroundColor: 'transparent', yAxisID: 'y1' },
    ],
    { max: 20, unit: '', y1: ' ms' }
  );

  let lastNet = null;
  let lastTs = 0;

  function push(chart, values) {
    if (!chart) return;
    chart.data.labels.push('');
    values.forEach((v, i) => chart.data.datasets[i].data.push(v));
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets.forEach((d) => d.data.shift());
    }
    chart.update('none');
  }

  function applyPerf(perf, supported) {
    if (supported === false) {
      // Every probe command has been tried and none answered.
      perfSupported = false;
      if (tpsCard) tpsCard.hidden = true;
      const tpsEl = metricEl('tps');
      const msptEl = metricEl('mspt');
      if (tpsEl && tpsEl.textContent === '…') tpsEl.textContent = 'n/a';
      if (msptEl && /reading|min/.test(msptEl.textContent)) msptEl.textContent = 'not reported';
      return;
    }
    if (supported === true && !perfSupported) {
      perfSupported = true;
      if (tpsCard) tpsCard.hidden = false;
    }
    if (!perf) return;
    const tpsEl = metricEl('tps');
    const msptEl = metricEl('mspt');
    if (tpsEl && perf.tps1 != null) tpsEl.textContent = perf.tps1.toFixed(1);
    if (msptEl) msptEl.textContent = perf.mspt != null ? `${perf.mspt.toFixed(1)} ms/tick` : 'last 1 min';
    push(tpsChart, [perf.tps1 ?? null, perf.mspt ?? null]);
  }

  // Reconnect with backoff and pause while the tab is hidden (otherwise the
  // charts draw a misleading unbroken line across the gap).
  let reconnectDelay = 5000;
  let ws = null;
  function connect() {
    if (document.hidden) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/stats/${serverId}`);
    ws.addEventListener('open', () => {
      reconnectDelay = 5000;
    });
    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.kind !== 'stats') return;
      const now = Date.now();
      const memMb = Math.round(msg.memUsedBytes / 1024 / 1024);
      push(cpuChart, [msg.cpuPct]);
      push(memChart, [memMb]);
      const cpuEl = metricEl('cpu');
      const memEl = metricEl('mem');
      if (cpuEl) cpuEl.textContent = `${msg.cpuPct}%`;
      if (memEl) memEl.textContent = String(memMb);
      if (lastNet && now > lastTs) {
        const dt = (now - lastTs) / 1000;
        push(netChart, [
          Math.max(0, Math.round((msg.netRx - lastNet.rx) / 1024 / dt)),
          Math.max(0, Math.round((msg.netTx - lastNet.tx) / 1024 / dt)),
        ]);
      }
      lastNet = { rx: msg.netRx, tx: msg.netTx };
      lastTs = now;
      applyPerf(msg.perf, msg.perfSupported);
    });
    ws.addEventListener('close', () => {
      if (document.hidden) return; // visibilitychange reconnects
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      ws?.close();
      lastNet = null; // rate math must not span the hidden gap
    } else {
      reconnectDelay = 5000;
      connect();
    }
  });
  connect();
}
