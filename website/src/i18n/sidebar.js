// Docs sidebar groups. `translations` is filled per locale by scripts/translate.js
// (Starlight's own key for translated group labels); an untranslated locale
// shows the English label.
import translations from './sidebar.translations.json' with { type: 'json' };

const GROUPS = [
  { id: 'start', label: 'Start here', items: ['docs', 'docs/getting-started', 'docs/dashboard'] },
  {
    id: 'guides',
    label: 'Guides',
    items: [
      'docs/guide-choosing-a-loader',
      'docs/guide-server-memory',
      'docs/guide-backups',
      'docs/guide-moving-a-server',
      'docs/guide-server-wont-start',
    ],
  },
  {
    id: 'running',
    label: 'Running servers',
    items: ['docs/servers', 'docs/console-and-chat', 'docs/modpacks', 'docs/worlds-and-files', 'docs/world-shrink'],
  },
  {
    id: 'data',
    label: 'Data & automation',
    items: [
      'docs/chatbot',
      'docs/backups',
      'docs/blueprints',
      'docs/schedules',
      'docs/storage',
      'docs/updates',
      'docs/activity',
      'docs/integrations',
      'docs/public-api',
    ],
  },
  { id: 'accounts', label: 'Accounts & security', items: ['docs/users-and-roles', 'docs/two-factor-authentication'] },
  { id: 'internals', label: 'Under the hood', items: ['docs/architecture', 'docs/website'] },
];

export const SIDEBAR_LABELS = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));

export function starlightSidebar() {
  return GROUPS.map((g) => ({ label: g.label, translations: translations[g.id] || {}, items: g.items }));
}
