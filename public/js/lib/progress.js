// Task progress modal: polls /api/tasks/:id and renders a REAL progress bar
// (step label, percent when known, recent log lines). Replaces fake pulse bars.
//
// runTask({ title, start }) — start() must return a task id (string) or an
// object {taskId}. Resolves with the task's result, rejects on failure.

import { openModal } from './modal.js';

export function runTask({ title, start, pollMs = 700 }) {
  return new Promise((resolve, reject) => {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <p data-step class="font-medium">Starting…</p>
      <div class="meter"><div data-bar class="bg-grass-500 transition-all" style="width:3%"></div></div>
      <p data-detail class="text-xs text-ink-faint"></p>
      <pre data-logs class="console hidden max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px]"></pre>`;
    const modal = openModal({ title, content, size: 'sm' });
    const stepEl = content.querySelector('[data-step]');
    const barEl = content.querySelector('[data-bar]');
    const detailEl = content.querySelector('[data-detail]');
    const logsEl = content.querySelector('[data-logs]');
    let closed = false;
    const origClose = modal.close;
    modal.close = (...a) => {
      closed = true;
      origClose(...a);
    };

    let creep = 3; // gentle creep while total is unknown, so it never looks frozen

    (async () => {
      let taskId;
      try {
        const started = await start();
        taskId = typeof started === 'string' ? started : started.taskId;
        if (!taskId) throw new Error('No task id returned');
      } catch (err) {
        modal.close();
        reject(err);
        return;
      }

      const poll = async () => {
        if (closed) return; // user dismissed — task keeps running server-side
        let data;
        try {
          const res = await fetch(`/api/tasks/${taskId}`);
          data = await res.json();
        } catch {
          setTimeout(poll, pollMs * 2);
          return;
        }
        if (!data.ok) {
          modal.close();
          reject(new Error(data.error || 'Task lost'));
          return;
        }
        const t = data.task;
        stepEl.textContent = t.step || t.title;
        if (t.percent != null) {
          barEl.style.width = `${Math.max(3, t.percent)}%`;
          detailEl.textContent = t.total ? `${fmt(t.current)} / ${fmt(t.total)} (${t.percent}%)` : '';
        } else {
          creep = Math.min(90, creep + 1.5);
          barEl.style.width = `${creep}%`;
          detailEl.textContent = `${Math.round(t.elapsedMs / 1000)}s elapsed`;
        }
        if (t.logs && t.logs.length) {
          logsEl.classList.remove('hidden');
          logsEl.textContent = t.logs.join('\n');
          logsEl.scrollTop = logsEl.scrollHeight;
        }
        if (t.state === 'done') {
          barEl.style.width = '100%';
          setTimeout(() => {
            modal.close();
            resolve(t.result);
          }, 350);
          return;
        }
        if (t.state === 'failed') {
          modal.close();
          const err = new Error(t.error || 'Task failed');
          if (t.requiresForce) err.requiresForce = true;
          if (t.requiresVersionConfirm) {
            err.requiresVersionConfirm = true;
            err.fromVersion = t.fromVersion;
            err.toVersion = t.toVersion;
          }
          reject(err);
          return;
        }
        setTimeout(poll, pollMs);
      };
      poll();
    })();
  });
}

function fmt(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return String(n);
}
