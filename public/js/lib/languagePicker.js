// Self-service language picker: the topbar user-menu "Language" entry
// opens a modal allowing any user (including viewers) to switch their language.

import { openModal } from './modal.js';
import { toast } from './toast.js';
import { friendlyError } from './errors.js';
import { t } from './i18n.js';

async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      toast(data.error || friendlyError(res, { actionKey: 'settings.language.save' }), {
        kind: 'error',
        timeout: 8000,
      });
      return null;
    }
    return data;
  } catch {
    toast(friendlyError(null, { actionKey: 'settings.language.save' }), { kind: 'error', timeout: 8000 });
    return null;
  }
}

const LANGUAGES = [
  { code: 'auto', nameKey: 'settings.language.auto' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'zh', name: '简体中文' },
  { code: 'ar', name: 'العربية' },
];

let pickerOpen = false;

document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-open-language-picker]')) return;
  openLanguageModal();
});

export function openLanguageModal() {
  if (pickerOpen) return;
  pickerOpen = true;

  const trigger = document.querySelector('[data-menu="user-menu"]');
  const current = trigger?.dataset.userLanguage || 'auto';

  const content = document.createElement('div');
  content.className = 'space-y-4';

  const form = document.createElement('div');
  form.className = 'space-y-2';

  for (const lang of LANGUAGES) {
    const label = document.createElement('label');
    label.className =
      'flex cursor-pointer items-center justify-between rounded-md border border-line bg-raised p-3 hover:border-line-focus';

    const text = document.createElement('span');
    text.className = 'text-sm font-medium';
    text.textContent = lang.nameKey ? t(lang.nameKey) : `${lang.name} (${lang.code})`;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'user-language';
    radio.value = lang.code;
    radio.className = 'msm-radio';
    if (current === lang.code) {
      radio.checked = true;
    }

    label.append(text, radio);
    form.appendChild(label);
  }

  content.appendChild(form);

  openModal({
    title: t('settings.language.label'),
    content,
    size: 'sm',
    onClose: () => {
      pickerOpen = false;
    },
    actions: [
      { label: t('common.cancel'), kind: 'ghost', onClick: () => true },
      {
        label: t('common.save'),
        kind: 'primary',
        onClick: async () => {
          const selected = form.querySelector('input[name="user-language"]:checked')?.value || 'auto';
          const res = await post('/api/account/language', { language: selected });
          if (res) {
            toast(t('settings.language.saved'));
            window.location.reload();
          }
          return true;
        },
      },
    ],
  });
}
