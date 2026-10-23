import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { withBusy } from '../lib/loading.js';

const root = document.querySelector('[data-bedrock-players]');
if (root) init(root);

function init(root) {
  const base = `/api/servers/${root.dataset.serverId}/players`;

  async function send(path, body) {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok)
      throw new Error(data.error || friendlyError(res, { action: 'update Bedrock permissions' }));
    return data.result;
  }

  root.querySelector('[data-bedrock-allowlist]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter;
    try {
      const result = await withBusy(button, () =>
        send('/bedrock-allowlist', { identity: form.elements.identity.value.trim(), on: button.value === 'true' })
      );
      toast(`${result.identity} ${result.allowlisted ? 'added to' : 'removed from'} the Bedrock allowlist.`);
    } catch (err) {
      toast(err.message || 'Could not update the Bedrock allowlist.', { kind: 'error' });
    }
  });

  root.querySelector('[data-bedrock-permission]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter;
    try {
      const result = await withBusy(button, () =>
        send('/bedrock-permission', {
          identity: form.elements.identity.value.trim(),
          permission: form.elements.permission.value,
        })
      );
      toast(`${result.identity} is now a Bedrock ${result.permission}.`);
    } catch (err) {
      toast(err.message || 'Could not update the Bedrock permission.', { kind: 'error' });
    }
  });
}
