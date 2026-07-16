// Overview tab: keep the "Live usage" card actually live. Subscribes to the
// same stats WebSocket the Metrics tab uses; without this the card showed the
// values from page load under a "Live" heading, forever.

const card = document.querySelector('[data-ov-live]');
if (card && card.dataset.running === '1') init(card);

function init(card) {
  const serverId = card.dataset.ovLive;
  const memLimit = Number(card.dataset.memLimit) || 0;
  const cpus = Number(card.dataset.cpus) || 0;
  const cpuLabel = card.querySelector('[data-ov-cpu-label]');
  const cpuBar = card.querySelector('[data-ov-cpu-bar]');
  const memLabel = card.querySelector('[data-ov-mem-label]');
  const memBar = card.querySelector('[data-ov-mem-bar]');

  const METER = ['bg-grass-500', 'bg-gold-400', 'bg-redstone-500'];
  function paint(bar, pct) {
    bar.style.width = `${Math.min(100, Math.round(pct))}%`;
    bar.classList.remove(...METER);
    bar.classList.add(pct >= 95 ? METER[2] : pct >= 80 ? METER[1] : METER[0]);
  }

  let ws = null;
  let delay = 5000;
  function connect() {
    if (document.hidden) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/stats/${serverId}`);
    ws.addEventListener('open', () => {
      delay = 5000;
    });
    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.kind !== 'stats') return;
      const memUsedMb = Math.round(msg.memUsedBytes / 1024 / 1024);
      cpuLabel.textContent = `${msg.cpuPct}%${cpus ? ` of ${cpus} cores` : ''}`;
      paint(cpuBar, (msg.cpuPct / (cpus ? cpus * 100 : 100)) * 100);
      if (memLimit) {
        memLabel.textContent = `${memUsedMb} / ${memLimit} MB`;
        paint(memBar, (memUsedMb / memLimit) * 100);
      } else {
        memLabel.textContent = `${memUsedMb} MB`;
      }
    });
    ws.addEventListener('close', () => {
      if (document.hidden) return;
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30000);
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ws?.close();
    else {
      delay = 5000;
      connect();
    }
  });
  connect();
}
