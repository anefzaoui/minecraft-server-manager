import { toast } from '../lib/toast.js';
import { setBusy } from '../lib/loading.js';
import { escapeHtml as esc } from '../lib/format.js';
import { t } from '../lib/i18n.js';

const root = document.querySelector('[data-investigation-server]');
if (root) init(root.dataset.investigationServer);

function init(serverId) {
  const results = document.getElementById('inv-results');
  document.getElementById('inv-run')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capture before await - currentTarget is null afterwards
    const restore = setBusy(btn, t('analytics_tab.analyzing'));
    results.textContent = t('analytics_tab.analyzing');
    try {
      const res = await fetch(`/api/servers/${serverId}/analytics/xray`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'The analysis could not be completed. Please try again.');
      render(data);
    } catch (err) {
      toast(err.message, { kind: 'error' });
      results.textContent = 'The analysis could not be completed. Please try again.';
    } finally {
      restore();
    }
  });

  function render(data) {
    const players = data.players || data.report || [];
    if (!players.length) {
      results.textContent = t('analytics_tab.no_mining_data');
      return;
    }
    results.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'table-base table-stack';
    table.innerHTML = `<thead><tr><th>${esc(t('analytics_tab.th_player'))}</th><th class="text-right">${esc(t('analytics_tab.th_stone_mined'))}</th><th class="text-right">${esc(t('analytics_tab.th_diamonds'))}</th><th class="text-right">${esc(t('analytics_tab.th_diamond_ratio'))}</th><th>${esc(t('analytics_tab.th_verdict'))}</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    for (const p of players) {
      const tr = document.createElement('tr');
      const flagged = p.flagged || p.suspicious;
      tr.innerHTML = `
        <td data-th="${esc(t('analytics_tab.th_player'))}" class="font-medium"></td>
        <td data-th="${esc(t('analytics_tab.th_stone_mined'))}" class="text-right text-ink-faint">${Number(p.stoneMined || 0).toLocaleString()}</td>
        <td data-th="${esc(t('analytics_tab.th_diamonds'))}" class="text-right text-ink-faint">${Number(p.diamondsMined || 0).toLocaleString()}</td>
        <td data-th="${esc(t('analytics_tab.th_diamond_ratio'))}" class="text-right font-mono text-xs">${p.diamondRatio != null ? Number(p.diamondRatio).toFixed(4) : '-'}${p.medianRatio != null ? ` <span class="text-ink-faint">(${esc(t('analytics_tab.median', { value: Number(p.medianRatio).toFixed(4) }))})</span>` : ''}</td>
        <td data-th="${esc(t('analytics_tab.th_verdict'))}">${flagged ? `<span class="badge badge-danger">${esc(t('analytics_tab.verdict_suspicious'))}</span>` : `<span class="badge badge-ok">${esc(t('analytics_tab.verdict_normal'))}</span>`}</td>`;
      tr.querySelector('td').textContent = p.name || p.uuid;
      tbody.appendChild(tr);
    }
    const wrap = document.createElement('div');
    wrap.className = 'overflow-x-auto';
    wrap.appendChild(table);
    results.appendChild(wrap);
  }
}
