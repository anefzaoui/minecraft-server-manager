// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Discord webhook notifications (MP6, webhook mode only — no bot).
// The webhook URL is a secret and lives encrypted in integrations.config_cipher;
// per-event toggles live in plain config_json. Delivery is fire-and-forget:
// a broken webhook must never break panel operations.

const httpError = require('../utils/httpError');
const db = require('../db');
const secrets = require('../services/secrets');

const KIND = 'discord-webhook';

const DEFAULT_EVENTS = { lifecycle: true, crashes: true, backups: true, updates: true, players: true };

const WEBHOOK_RE = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//;

// Embed accent color per notification kind (decimal RGB, matches panel palette).
const COLORS = {
  crash: 0xe5484d, // red
  start: 0x3fa62b, // green
  stop: 0x8b8f98, // grey
  backup: 0x3b82f6, // blue
  update: 0xe99417, // gold
  player: 0x21a7ab, // teal
};

// History event type → [notification kind, toggle category]
const EVENT_MAP = {
  started: ['start', 'lifecycle'],
  stopped: ['stop', 'lifecycle'],
  crashed: ['crash', 'crashes'],
  'crash-loop': ['crash', 'crashes'],
  'backup-created': ['backup', 'backups'],
  'backup-restored': ['backup', 'backups'],
  'update-applied': ['update', 'updates'],
  'update-rolled-back': ['update', 'updates'],
  'update-failed': ['update', 'updates'],
  'player-ban': ['player', 'players'],
  'player-kick': ['player', 'players'],
};

function row(serverId) {
  return db.get('SELECT * FROM integrations WHERE server_id = ? AND kind = ?', serverId, KIND);
}

/** Masked, UI-safe view of the config. Never returns the webhook URL. */
function getConfig(serverId) {
  const r = row(serverId);
  const cfg = r ? JSON.parse(r.config_json || '{}') : {};
  return {
    enabled: Boolean(r && r.enabled),
    hasWebhook: Boolean(r && r.config_cipher),
    webhookMasked: r && r.config_cipher ? maskWebhook(webhookUrl(serverId)) : null,
    events: { ...DEFAULT_EVENTS, ...(cfg.events || {}) },
  };
}

/** Decrypted webhook URL (internal use only — never expose over HTTP). */
function webhookUrl(serverId) {
  const r = row(serverId);
  if (!r || !r.config_cipher) return null;
  try {
    return JSON.parse(secrets.decrypt(r.config_cipher)).webhookUrl || null;
  } catch {
    return null; // SESSION_SECRET changed — treat as unset
  }
}

function maskWebhook(url) {
  if (!url) return null;
  // Keep scheme/host/webhook id, hide the token entirely.
  const m = /^(https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+)\//.exec(url);
  return m ? `${m[1]}/••••••••` : 'https://discord.com/api/webhooks/••••••••';
}

/**
 * Upsert the config. webhookUrl: undefined = keep current, '' or null = clear,
 * string = validate + encrypt. events merges over the stored toggles.
 */
function setConfig(serverId, { enabled, webhookUrl: url, events } = {}) {
  const existing = row(serverId);
  const cfg = existing ? JSON.parse(existing.config_json || '{}') : {};
  const nextEvents = { ...DEFAULT_EVENTS, ...(cfg.events || {}), ...(events || {}) };

  let cipher = existing ? existing.config_cipher : null;
  if (url !== undefined) {
    if (url === null || url === '') {
      cipher = null;
    } else {
      if (!WEBHOOK_RE.test(url)) throw httpError(400, 'Webhook URL must start with https://discord.com/api/webhooks/');
      cipher = secrets.encrypt(JSON.stringify({ webhookUrl: url }));
    }
  }

  db.run(
    `INSERT INTO integrations (server_id, kind, enabled, config_cipher, config_json, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(server_id, kind) DO UPDATE SET
       enabled = excluded.enabled, config_cipher = excluded.config_cipher,
       config_json = excluded.config_json, updated_at = excluded.updated_at`,
    serverId,
    KIND,
    (enabled === undefined ? Boolean(existing && existing.enabled) : Boolean(enabled)) ? 1 : 0,
    cipher,
    JSON.stringify({ events: nextEvents })
  );
  return getConfig(serverId);
}

/** Send a test embed so the user can confirm the webhook works. Throws on failure. */
async function testWebhook(serverId) {
  const url = webhookUrl(serverId);
  if (!url) throw httpError(400, 'No webhook URL saved for this server yet');
  const server = db.get('SELECT display_name FROM servers WHERE id = ?', serverId);
  const res = await post(
    url,
    buildEmbed('start', {
      title: 'Minecraft Server Manager test notification',
      description: `Webhook is wired up for **${server ? server.display_name : serverId}**. You will receive the event types you enabled.`,
    })
  );
  if (!res.ok) throw httpError(502, `Discord answered HTTP ${res.status} — check the webhook URL`);
  return { ok: true };
}

/**
 * Send a notification if the integration is enabled and has a webhook.
 * Never throws; failures are logged at most once per hour per server.
 */
async function notify(serverId, kind, payload = {}) {
  const r = row(serverId);
  if (!r || !r.enabled || !r.config_cipher) return false;
  const url = webhookUrl(serverId);
  if (!url) return false;
  try {
    const res = await post(url, buildEmbed(kind, payload));
    if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
    return true;
  } catch (err) {
    logThrottled(serverId, err);
    return false;
  }
}

function buildEmbed(kind, { title, description, fields } = {}) {
  return {
    username: 'Minecraft Server Manager',
    embeds: [
      {
        title: title || 'Server event',
        description: description || undefined,
        color: COLORS[kind] || COLORS.stop,
        fields: (fields || []).slice(0, 10).map((f) => ({
          name: String(f.name).slice(0, 256),
          value: String(f.value).slice(0, 1024),
          inline: f.inline !== false,
        })),
        timestamp: new Date().toISOString(),
        footer: { text: 'Minecraft Server Manager' },
      },
    ],
  };
}

function post(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}

// One error log line per server per hour — a dead webhook must not spam the panel log.
const lastErrorLog = new Map();
function logThrottled(serverId, err) {
  const last = lastErrorLog.get(serverId) || 0;
  if (Date.now() - last < 60 * 60 * 1000) return;
  lastErrorLog.set(serverId, Date.now());
  console.warn(`[discord] webhook delivery failed for ${serverId} (muted for 1h): ${err.message}`);
}

// ---------------------------------------------------------------------------
// Event bridge: polls the events table (the single source of truth for panel
// history) and forwards mapped rows to Discord. Polling instead of hooking
// recordEvent keeps this module fully decoupled from every event producer.

let pollTimer = null;
let lastSeenId = 0;

function startEventBridge({ intervalMs = 15000 } = {}) {
  if (pollTimer) return;
  // Start at the current high-water mark: never replay pre-boot history.
  lastSeenId = db.get('SELECT COALESCE(MAX(id), 0) AS id FROM events')?.id || 0;
  pollTimer = setInterval(() => {
    pollOnce().catch((err) => console.warn('[discord] event bridge poll failed:', err.message));
  }, intervalMs);
  if (pollTimer.unref) pollTimer.unref();
}

function stopEventBridge() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function pollOnce() {
  const rows = db.all('SELECT * FROM events WHERE id > ? ORDER BY id LIMIT 100', lastSeenId);
  if (!rows.length) return;
  lastSeenId = rows[rows.length - 1].id;

  for (const evt of rows) {
    const mapped = EVENT_MAP[evt.type];
    if (!mapped || !evt.server_id) continue;
    const [kind, category] = mapped;
    const cfg = getConfig(evt.server_id);
    if (!cfg.enabled || !cfg.hasWebhook || !cfg.events[category]) continue;

    const server = db.get('SELECT display_name FROM servers WHERE id = ?', evt.server_id);
    await notify(evt.server_id, kind, {
      title: titleFor(evt.type),
      description: evt.summary,
      fields: [
        { name: 'Server', value: server ? server.display_name : evt.server_id },
        { name: 'By', value: evt.actor || 'system' },
      ],
    });
  }
}

function titleFor(type) {
  const map = {
    started: 'Server started',
    stopped: 'Server stopped',
    crashed: 'Server crashed',
    'crash-loop': 'Crash loop detected',
    'backup-created': 'Backup created',
    'backup-restored': 'Backup restored',
    'update-applied': 'Update applied',
    'update-rolled-back': 'Update rolled back',
    'update-failed': 'Update failed',
    'player-ban': 'Player banned',
    'player-kick': 'Player kicked',
  };
  return map[type] || type;
}

module.exports = { getConfig, setConfig, testWebhook, notify, startEventBridge, stopEventBridge, WEBHOOK_RE };
