// Advanced Docker settings UI: container name/network inputs, extra port/bind
// repeaters, and the "Preview as YAML" modal round trip. Shared by the create
// wizard (pre-creation, POST /api/docker/preview) and the server Settings tab
// (post-creation, GET /api/servers/:id/docker-spec) - same fields and Apply
// flow, only how the preview YAML is fetched differs.
import { toast } from './toast.js';
import { openModal } from './modal.js';
import { enhanceSelect, syncSelectTrigger } from './select.js';

const REMOVE_ICON_SVG =
  '<svg class="icon size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

/**
 * @param {object} ids - element ids: name, network, ports, binds, portAdd, bindAdd, previewBtn
 *
 * The card these ids live in is admin-only markup - for other roles every
 * element is absent (and the endpoints 403), so all DOM access and the
 * networks fetch degrade to no-ops rather than assuming the elements exist.
 */
export function initDockerSettings(ids) {
  const nameInput = document.getElementById(ids.name);
  const networkSel = document.getElementById(ids.network);
  const portsWrap = document.getElementById(ids.ports);
  const bindsWrap = document.getElementById(ids.binds);

  // seed() can run before this resolves (e.g. the Settings tab seeds from the
  // server's current row immediately on load) - remember the desired value and
  // re-apply it once the matching <option> actually exists.
  let pendingNetwork = null;
  if (networkSel)
    fetch('/api/docker/networks')
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok || !networkSel) return;
        for (const net of data.networks) {
          const opt = document.createElement('option');
          opt.value = net.name;
          opt.textContent = `${net.name} (${net.driver})`;
          networkSel.appendChild(opt);
        }
        if (pendingNetwork != null) networkSel.value = pendingNetwork;
        syncSelectTrigger(networkSel); // sync the styled trigger - not a real edit, don't mark the page dirty
      })
      .catch(() => {}); // Docker unreachable - leave just the default option

  function addPortRow(value = {}) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-2';
    row.dataset.portRow = '';
    row.innerHTML = `
      <input class="input w-28 font-mono" type="number" min="1024" max="65535" placeholder="Host port" data-port-host>
      <span class="text-ink-faint">&rarr;</span>
      <input class="input w-28 font-mono" type="number" min="1" max="65535" placeholder="Container port" data-port-container>
      <select class="input w-24" data-port-proto><option value="tcp">TCP</option><option value="udp">UDP</option></select>
      <input class="input min-w-32 flex-1" placeholder="Label (optional)" data-port-label>
      <button type="button" class="icon-btn shrink-0 hover:text-danger" aria-label="Remove port mapping">${REMOVE_ICON_SVG}</button>`;
    row.querySelector('[data-port-host]').value = value.hostPort || '';
    row.querySelector('[data-port-container]').value = value.containerPort || '';
    row.querySelector('[data-port-proto]').value = value.protocol || 'tcp';
    row.querySelector('[data-port-label]').value = value.label || '';
    row.querySelector('button').addEventListener('click', () => row.remove());
    portsWrap.appendChild(row);
    enhanceSelect(row.querySelector('[data-port-proto]'));
  }

  function addBindRow(value = {}) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-2';
    row.dataset.bindRow = '';
    row.innerHTML = `
      <input class="input min-w-40 flex-1 font-mono text-xs" placeholder="Host path (e.g. /opt/msm/extra/geyser)" data-bind-host>
      <span class="text-ink-faint">&rarr;</span>
      <input class="input min-w-32 flex-1 font-mono text-xs" placeholder="Container path" data-bind-container>
      <select class="input w-20" data-bind-mode><option value="rw">RW</option><option value="ro">RO</option></select>
      <button type="button" class="icon-btn shrink-0 hover:text-danger" aria-label="Remove volume bind">${REMOVE_ICON_SVG}</button>`;
    row.querySelector('[data-bind-host]').value = value.hostPath || '';
    row.querySelector('[data-bind-container]').value = value.containerPath || '';
    row.querySelector('[data-bind-mode]').value = value.mode || 'rw';
    row.querySelector('button').addEventListener('click', () => row.remove());
    bindsWrap.appendChild(row);
    enhanceSelect(row.querySelector('[data-bind-mode]'));
  }

  document.getElementById(ids.portAdd)?.addEventListener('click', () => addPortRow());
  document.getElementById(ids.bindAdd)?.addEventListener('click', () => addBindRow());

  function readPortRows() {
    if (!portsWrap) return [];
    return [...portsWrap.querySelectorAll('[data-port-row]')]
      .map((row) => ({
        hostPort: Number(row.querySelector('[data-port-host]').value),
        containerPort: Number(row.querySelector('[data-port-container]').value),
        protocol: row.querySelector('[data-port-proto]').value,
        label: row.querySelector('[data-port-label]').value.trim() || undefined,
      }))
      .filter((p) => p.hostPort && p.containerPort);
  }

  function readBindRows() {
    if (!bindsWrap) return [];
    return [...bindsWrap.querySelectorAll('[data-bind-row]')]
      .map((row) => ({
        hostPath: row.querySelector('[data-bind-host]').value.trim(),
        containerPath: row.querySelector('[data-bind-container]').value.trim(),
        mode: row.querySelector('[data-bind-mode]').value,
      }))
      .filter((b) => b.hostPath && b.containerPath);
  }

  function seed({ containerName, networkName, extraPorts, extraBinds } = {}) {
    if (nameInput) nameInput.value = containerName || '';
    pendingNetwork = networkName || '';
    if (networkSel) {
      networkSel.value = pendingNetwork;
      syncSelectTrigger(networkSel);
    }
    if (portsWrap) {
      portsWrap.innerHTML = '';
      (extraPorts || []).forEach(addPortRow);
    }
    if (bindsWrap) {
      bindsWrap.innerHTML = '';
      (extraBinds || []).forEach(addBindRow);
    }
  }

  /**
   * Collect the 4 override fields as a plain object.
   * By default omits empty ones (right for creation - nothing to clear yet).
   * Pass forUpdate: true (Settings tab) to always include all 4, so an emptied
   * field is sent as '' / [] and actually clears the stored value, instead of
   * being silently dropped from the PATCH body.
   */
  function collectOverrides({ forUpdate = false } = {}) {
    const out = {};
    const name = nameInput?.value.trim() || '';
    if (name || forUpdate) out.containerName = name;
    const network = networkSel?.value || '';
    if (network || forUpdate) out.networkName = network;
    const extraPorts = readPortRows();
    if (extraPorts.length || forUpdate) out.extraPorts = extraPorts;
    const extraBinds = readBindRows();
    if (extraBinds.length || forUpdate) out.extraBinds = extraBinds;
    return out;
  }

  /** fetchYaml(): Promise<string> - how to obtain the preview text for this context. */
  function openPreview(fetchYaml) {
    const btn = document.getElementById(ids.previewBtn);
    btn?.addEventListener('click', async () => {
      let yamlText;
      try {
        yamlText = await fetchYaml();
      } catch (err) {
        toast(err.message || 'The panel could not build the preview. Please try again.', { kind: 'error' });
        return;
      }
      const content = document.createElement('div');
      content.innerHTML =
        '<textarea class="input h-96 w-full resize-y font-mono text-xs leading-relaxed" spellcheck="false"></textarea>';
      const textarea = content.querySelector('textarea');
      textarea.value = yamlText;
      openModal({
        title: 'Advanced Docker Settings Preview',
        content,
        size: 'lg',
        actions: [
          { label: 'Cancel', kind: 'ghost' },
          {
            label: 'Apply',
            kind: 'primary',
            onClick: async () => {
              const res = await fetch('/api/docker/preview/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ yaml: textarea.value }),
              });
              const data = await res.json();
              if (!res.ok || !data.ok) {
                toast(data.error || "That YAML couldn't be read. Check the syntax and try again.", {
                  kind: 'error',
                  timeout: 9000,
                });
                return false;
              }
              seed(data.spec);
              toast('Docker settings updated from the preview.');
            },
          },
        ],
      });
      textarea.focus();
    });
  }

  return { seed, collectOverrides, openPreview };
}
