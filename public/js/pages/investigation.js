// Investigation card (analytics tab): x-ray suspicion report.
import { toast } from '../lib/toast.js';
import { setBusy } from '../lib/loading.js';

const root = document.querySelector('[data-investigation-server]');
if (root) init(root.dataset.investigationServer);

function init(serverId) {
  const results = document.getElementById('inv-results');
  document.getElementById('inv-run')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capture before await — currentTarget is null afterwards
    const restore = setBusy(btn, 'Analyzing…');
    results.textContent = 'Analyzing…';
    try {
      const res = await fetch(`/api/servers/${serverId}/analytics/xray`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Analysis failed');
      render(data);
    } catch (err) {
      toast(err.message, { kind: 'error' });
      results.textContent = 'Analysis failed — see the toast for details.';
    } finally {
      restore();
    }
  });

  function render(data) {
    const players = data.players || data.report || [];
    if (!players.length) {
      results.textContent = 'No player mining data yet — stats appear once players join and mine.';
      return;
    }
    results.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'table-base';
    table.innerHTML = `<thead><tr><th>Player</th><th class="text-right">Stone mined</th><th class="text-right">Diamonds</th><th class="text-right">Diamond ratio</th><th>Verdict</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    for (const p of players) {
      const tr = document.createElement('tr');
      const flagged = p.flagged || p.suspicious;
      tr.innerHTML = `
        <td class="font-medium"></td>
        <td class="text-right text-ink-faint">${Number(p.stoneMined || 0).toLocaleString()}</td>
        <td class="text-right text-ink-faint">${Number(p.diamondsMined || 0).toLocaleString()}</td>
        <td class="text-right font-mono text-xs">${p.diamondRatio != null ? Number(p.diamondRatio).toFixed(4) : '—'}${p.medianRatio != null ? ` <span class="text-ink-faint">(median ${Number(p.medianRatio).toFixed(4)})</span>` : ''}</td>
        <td>${flagged ? '<span class="badge badge-danger">suspicious</span>' : '<span class="badge badge-ok">normal</span>'}</td>`;
      tr.querySelector('td').textContent = p.name || p.uuid;
      tbody.appendChild(tr);
    }
    const wrap = document.createElement('div');
    wrap.className = 'overflow-x-auto';
    wrap.appendChild(table);
    results.appendChild(wrap);
  }
}
