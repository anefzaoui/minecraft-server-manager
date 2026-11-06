import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { escapeHtml } from '../lib/format.js';

const root = document.querySelector('[data-mod-configs]');
root?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-mod-config]');
  if (button) openConfig(button.dataset.path);
});

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || friendlyError(response));
  return data;
}

async function openConfig(filePath) {
  try {
    const data = await request(
      `/api/servers/${root.dataset.serverId}/configs/file?path=${encodeURIComponent(filePath)}`
    );
    showEditor(data.path, data.content, data.descriptions || {});
  } catch (error) {
    toast(error.message || friendlyError(error, { action: 'load this config' }), { kind: 'error' });
  }
}

function parseConfig(content, extension, descriptions = {}) {
  if (['.json', '.jsonc'].includes(extension)) {
    try {
      const value = JSON.parse(content);
      if (!value || typeof value !== 'object') return null;
      const fields = [];
      flatten(value, [], fields, descriptions);
      return { kind: 'json', value, fields };
    } catch {
      return null;
    }
  }
  if (['.toml', '.ini', '.cfg', '.conf', '.properties'].includes(extension)) {
    const lines = content.split(/\r?\n/);
    const fields = [];
    let section = '';
    let comments = [];
    lines.forEach((line, index) => {
      const sectionMatch = /^\s*\[([^\]]+)\]/.exec(line);
      if (sectionMatch) {
        section = sectionMatch[1];
        comments = [];
        return;
      }
      const comment = /^\s*[#;]\s?(.*)$/.exec(line);
      if (comment) {
        comments.push(comment[1].trim());
        return;
      }
      if (!line.trim()) {
        comments = [];
        return;
      }
      const match = /^(\s*(?:[^#;\s][^=:#]*?)\s*[=:]\s*)(.*?)(\s*(?:#|;).*)?$/.exec(line);
      if (match) {
        const rawValue = match[2];
        const value = /^(true|false)$/i.test(rawValue)
          ? rawValue.toLowerCase() === 'true'
          : /^[-+]?\d+(?:\.\d+)?$/.test(rawValue)
            ? Number(rawValue)
            : rawValue;
        const rawKey = match[1].trim().replace(/[=:]\s*$/, '');
        const parts = rawKey.split('.');
        const group = section || (parts.length > 1 ? parts.slice(0, -1).join('.') : 'General');
        const inlineDescription = (match[3] || '').replace(/^\s*[#;]\s?/, '').trim();
        const description =
          descriptions[rawKey] || descriptions[rawKey.toLowerCase()] || comments.join(' ') || inlineDescription;
        fields.push({
          index,
          prefix: match[1],
          value,
          suffix: match[3] || '',
          group,
          key: parts.at(-1),
          description,
        });
      }
      comments = [];
    });
    if (fields.length) return { kind: 'lines', lines, fields };
  }
  return null;
}

function flatten(value, path, fields, descriptions = {}) {
  if (Array.isArray(value)) return;
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, [...path, key], fields, descriptions);
  } else {
    const dottedPath = path.join('.');
    fields.push({ path, value, description: descriptions[dottedPath] || descriptions[path.at(-1)] || '' });
  }
}

function showEditor(filePath, original, descriptions) {
  const extension = `.${filePath.split('.').pop().toLowerCase()}`;
  let parsed = parseConfig(original, extension, descriptions);
  const dialog = document.createElement('div');
  dialog.innerHTML = `
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p class="min-w-0 truncate font-mono text-xs text-ink-faint">${escapeHtml(filePath)}</p>
      <div class="flex gap-1" role="group" aria-label="Editor mode">
        <button type="button" class="btn btn-sm" data-mode="form" ${parsed ? '' : 'disabled'}>Form</button>
        <button type="button" class="btn btn-sm btn-ghost" data-mode="raw">Raw</button>
      </div>
    </div>
    <div class="grid gap-2" data-editor-form>${parsed ? renderFields(parsed) : '<p class="help">This format could not be safely rendered as fields. Use raw view to edit the file.</p>'}</div>
    <textarea class="input hidden min-h-80 w-full resize-y font-mono text-xs" data-editor-raw spellcheck="false"></textarea>
    <p class="help mt-3">Some settings only take effect after the server restarts.</p>`;
  const raw = dialog.querySelector('[data-editor-raw]');
  const form = dialog.querySelector('[data-editor-form]');
  let mode = parsed ? 'form' : 'raw';
  raw.value = original;
  syncMode();

  dialog.querySelectorAll('[data-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      if (button.dataset.mode === mode) return;
      if (mode === 'form') raw.value = serialize(parsed, dialog);
      else if (parsed) {
        parsed = parseConfig(raw.value, extension, descriptions);
        form.innerHTML = parsed
          ? renderFields(parsed)
          : '<p class="help">This format could not be safely rendered as fields. Use raw view to edit the file.</p>';
      }
      mode = button.dataset.mode;
      syncMode();
    })
  );

  function syncMode() {
    raw.classList.toggle('hidden', mode !== 'raw');
    form.classList.toggle('hidden', mode !== 'form');
    dialog.querySelectorAll('[data-mode]').forEach((button) => {
      button.classList.toggle('btn-ghost', button.dataset.mode !== mode);
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
  }

  openModal({
    title: filePath.split('/').pop(),
    content: dialog,
    size: 'xl',
    actions: [
      { label: 'Close', kind: 'ghost' },
      {
        label: 'Save Changes',
        kind: 'primary',
        busyLabel: 'Saving…',
        onClick: async () => {
          try {
            const content = mode === 'raw' ? raw.value : serialize(parsed, dialog);
            await request(`/api/servers/${root.dataset.serverId}/configs/file`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: filePath, content }),
            });
            toast('Config saved.');
          } catch (error) {
            toast(error.message || friendlyError(error, { action: 'save this config' }), { kind: 'error' });
            return false;
          }
        },
      },
    ],
  });
}

function serialize(parsed, dialog) {
  if (!parsed) return dialog.querySelector('[data-editor-raw]').value;
  if (parsed.kind === 'json') {
    const result = structuredClone(parsed.value);
    parsed.fields.forEach((field, index) => {
      const input = dialog.querySelector(`[data-field="${index}"]`);
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (input.dataset.type === 'number') value = Number(value);
      if (input.dataset.type === 'boolean') value = value === 'true';
      let target = result;
      for (const key of field.path.slice(0, -1)) target = target[key];
      target[field.path.at(-1)] = value;
    });
    return `${JSON.stringify(result, null, 2)}\n`;
  }
  const lines = [...parsed.lines];
  parsed.fields.forEach((field, index) => {
    const input = dialog.querySelector(`[data-field="${index}"]`);
    const value = input.type === 'checkbox' ? String(input.checked) : input.value;
    lines[field.index] = `${field.prefix}${value}${field.suffix}`;
  });
  return lines.join('\n');
}

function renderFields(parsed) {
  const groups = new Map();
  parsed.fields.forEach((field, index) => {
    const group =
      parsed.kind === 'json' ? (field.path.length > 1 ? field.path.slice(0, -1).join(' › ') : 'General') : field.group;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ field, index });
  });
  return (
    [...groups.entries()]
      .map(
        ([group, fields]) => `
    <details class="card overflow-hidden">
      <summary class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold hover:bg-hover">
        <span class="min-w-0 truncate" title="${escapeHtml(group)}">${escapeHtml(group)}</span>
        <span class="badge shrink-0">${fields.length} settings</span>
      </summary>
      <div class="border-t border-line px-3 pb-2">
        ${fields
          .map(({ field, index }) => {
            const key = parsed.kind === 'json' ? field.path.at(-1) : field.key;
            const value = field.value;
            const description = field.description
              ? `<p id="config-description-${index}" class="mt-0.5 max-w-prose text-xs leading-relaxed text-ink-faint">${escapeHtml(field.description)}</p>`
              : '';
            const control =
              typeof value === 'boolean'
                ? `<input id="config-field-${index}" class="msm-check shrink-0" type="checkbox" data-field="${index}" ${value ? 'checked' : ''}>`
                : `<input id="config-field-${index}" class="input h-8 w-36 min-w-0 px-2 py-1 text-xs sm:w-40" data-field="${index}" data-type="${typeof value}" ${typeof value === 'number' ? 'type="number" step="any"' : ''} value="${escapeHtml(value)}">`;
            const describedBy = field.description ? `aria-describedby="config-description-${index}"` : '';
            return `<div class="flex min-w-0 items-center gap-4 border-b border-line py-2"><div class="min-w-0 flex-1"><label class="block truncate text-sm font-medium text-ink" for="config-field-${index}" title="${escapeHtml(key)}">${escapeHtml(key)}</label>${description}</div>${control.replace('data-field=', `${describedBy} data-field=`)}</div>`;
          })
          .join('')}
      </div>
    </details>`
      )
      .join('') || '<p class="help">No editable settings were found in this file.</p>'
  );
}
