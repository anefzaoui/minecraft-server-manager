'use strict';

// Third-party API key storage (encrypted at rest) + validity testing.
// The CurseForge key from .env is imported once on boot if none is stored.

const db = require('../db');
const config = require('../config');
const secrets = require('./secrets');
const { recordEvent } = require('../events');

function getKey(provider) {
  const row = db.get('SELECT key_cipher FROM api_keys WHERE provider = ?', provider);
  if (!row) return null;
  const key = secrets.tryDecrypt(row.key_cipher);
  if (key === null) {
    // SESSION_SECRET changed — treat as "no key" so features degrade to their
    // friendly "add your key in Settings" paths instead of crashing.
    console.warn(
      `[keys] stored ${provider} key cannot be decrypted (SESSION_SECRET changed) — re-enter it in Settings`
    );
  }
  return key;
}

function setKey(provider, key, { actor = 'system' } = {}) {
  db.run(
    `INSERT INTO api_keys (provider, key_cipher) VALUES (?, ?)
     ON CONFLICT(provider) DO UPDATE SET key_cipher = excluded.key_cipher, added_at = datetime('now')`,
    provider,
    secrets.encrypt(key)
  );
  recordEvent({ actor, type: 'api-key-set', summary: `API key updated for ${provider}` });

  // Containers bake the key into their env at create time — a rotated key
  // only reaches CurseForge servers after a recreate. Flag them.
  if (provider === 'curseforge') {
    const flagged = db.run(
      "UPDATE servers SET pending_recreate = 1 WHERE deleted_at IS NULL AND (type = 'AUTO_CURSEFORGE' OR env_json LIKE '%CF_SLUG%' OR env_json LIKE '%CURSEFORGE_FILES%')"
    );
    if (Number(flagged.changes) > 0) {
      recordEvent({
        actor,
        type: 'api-key-set',
        summary: `${flagged.changes} CurseForge server(s) flagged for recreate to pick up the new key`,
      });
    }
  }
}

function deleteKey(provider, { actor = 'system' } = {}) {
  db.run('DELETE FROM api_keys WHERE provider = ?', provider);
  recordEvent({ actor, type: 'api-key-removed', summary: `API key removed for ${provider}` });
}

function maskedKey(provider) {
  const key = getKey(provider);
  if (!key) return null;
  return key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '••••';
}

/** Live-test the CurseForge key against their games endpoint. */
async function testCurseForgeKey(key = getKey('curseforge')) {
  if (!key) return { ok: false, error: 'No key stored' };
  try {
    const res = await fetch('https://api.curseforge.com/v1/games?index=0&pageSize=1', {
      headers: { 'x-api-key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    const ok = res.ok;
    db.run(
      "UPDATE api_keys SET last_tested_at = datetime('now'), last_test_ok = ? WHERE provider = 'curseforge'",
      ok ? 1 : 0
    );
    return ok ? { ok: true } : { ok: false, error: `CurseForge answered HTTP ${res.status} — check the key` };
  } catch (err) {
    return { ok: false, error: `Could not reach CurseForge: ${err.message}` };
  }
}

/** One-time import from .env so the user's key lands in the encrypted store. */
function importFromEnvOnce() {
  if (config.cfApiKeySeed && !db.get("SELECT 1 AS x FROM api_keys WHERE provider = 'curseforge'")) {
    setKey('curseforge', config.cfApiKeySeed.replace(/^'|'$/g, ''), { actor: 'system' });
    console.log('[keys] imported CurseForge API key from .env into encrypted store');
  }
}

module.exports = { getKey, setKey, deleteKey, maskedKey, testCurseForgeKey, importFromEnvOnce };
