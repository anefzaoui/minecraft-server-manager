// Metrics tab: live CPU/memory/network charts fed by the stats WebSocket.
// Chart.js is loaded globally from /vendor/chart.umd.js by the partial.

const root = document.querySelector('[data-metrics-server]');
if (root && window.Chart)
  init(
    root.dataset.metricsServer,
    Number(root.dataset.metricsMemLimit) || 0,
    Number(root.dataset.metricsCpuLimit) || 0
  );

function init(serverId, memLimitMb, cpuLimit) {
  const MAX_POINTS = 60;
  // Theme tokens, re-read on toggle: Chart.js paints on canvas, so it can't
  // follow CSS variables by itself — without this the axes sat at Chart.js's
  // default #666 in both themes.
  function themeColors() {
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--color-line').trim();
    return {
      grass: css.getPropertyValue('--color-grass-400').trim() || '#59c53e',
      diamond: css.getPropertyValue('--color-diamond-400').trim() || '#3cc5c7',
      gold: css.getPropertyValue('--color-gold-400').trim() || '#f0b42f',
      grid: line ? `${line}66` : 'rgba(128,128,128,.12)',
      tick: css.getPropertyValue('--color-ink-faint').trim() || '#87919b',
    };
  }
  let colors = themeColors();
  const charts = [];

  function makeChart(canvas, datasets, { max, unit } = {}) {
    const chart = new window.Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets },
      options: {
        responsive: true,
        animation: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: datasets.length > 1, labels: { boxWidth: 10, color: colors.tick } } },
        scales: {
          x: { display: false },
          y: {
            beginAtZero: true,
            suggestedMax: max,
            grid: { color: colors.grid },
            ticks: { callback: (v) => `${v}${unit || ''}`, color: colors.tick },
          },
        },
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

  let lastNet = null;
  let lastTs = 0;

  function push(chart, values) {
    chart.data.labels.push('');
    values.forEach((v, i) => chart.data.datasets[i].data.push(v));
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets.forEach((d) => d.data.shift());
    }
    chart.update('none');
  }

  // Reconnect with backoff (an intentionally-stopped server was being polled
  // flat-out every 5s forever) and pause entirely while the tab is hidden —
  // otherwise the charts draw a misleading unbroken line across the gap.
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
      push(cpuChart, [msg.cpuPct]);
      push(memChart, [Math.round(msg.memUsedBytes / 1024 / 1024)]);
      if (lastNet && now > lastTs) {
        const dt = (now - lastTs) / 1000;
        push(netChart, [
          Math.max(0, Math.round((msg.netRx - lastNet.rx) / 1024 / dt)),
          Math.max(0, Math.round((msg.netTx - lastNet.tx) / 1024 / dt)),
        ]);
      }
      lastNet = { rx: msg.netRx, tx: msg.netTx };
      lastTs = now;
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
