// @ts-nocheck - dynamic provider HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Offsite backup destinations: Nextcloud (WebDAV login), Dropbox and Google
// Drive (both OAuth refresh tokens). Local backups stay the default - nothing
// leaves the machine unless a destination is connected and either its
// auto-upload switch is on or an archive is uploaded explicitly.
//
// All provider traffic is plain fetch (no new dependencies). Archives stream
// file-to-socket in both directions, never buffered whole. Credentials live
// encrypted via services/secrets.js; client ids (public by design) live in
// the clear config.

const { nanoid } = require('nanoid');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const db = require('../db');
const httpError = require('../utils/httpError');
const secrets = require('./secrets');
const { recordEvent } = require('../events');
const { dataPath } = require('../storage/pathGuard');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

const PROVIDERS = {
  nextcloud: { label: 'Nextcloud', oauth: false },
  dropbox: { label: 'Dropbox', oauth: true },
  gdrive: { label: 'Google Drive', oauth: true },
};

const CONTROL_TIMEOUT_MS = 30000;
const TRANSFER_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const DBX_CHUNK_BYTES = 32 * 1024 * 1024;
const DBX_SINGLE_MAX_BYTES = 140 * 1024 * 1024;
const GDRIVE_CHUNK_BYTES = 8 * 1024 * 1024;
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';

function withTimeout(ms) {
  return { signal: AbortSignal.timeout(ms) };
}

function err(status, message) {
  return httpError(status, message);
}

// ---- Destination store ----------------------------------------------------

function rowToPublic(row) {
  if (!row) return null;
  let config;
  try {
    config = JSON.parse(row.config_json || '{}');
  } catch {
    config = {};
  }
  if (!config || typeof config !== 'object') config = {};
  // "Connected" means ready to transfer: a password for Nextcloud, a refresh
  // token for the OAuth providers (a bare client secret is not enough).
  let authorized = false;
  if (row.secret_cipher) {
    try {
      const secret = JSON.parse(secrets.decrypt(row.secret_cipher));
      authorized = row.provider === 'nextcloud' ? Boolean(secret.password) : Boolean(secret.refreshToken);
    } catch {
      authorized = false;
    }
  }
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    providerLabel: (PROVIDERS[row.provider] || {}).label || row.provider,
    oauth: Boolean((PROVIDERS[row.provider] || {}).oauth),
    config,
    hasSecret: Boolean(row.secret_cipher),
    authorized,
    autoUpload: Boolean(row.auto_upload),
    createdAt: row.created_at,
  };
}

function listDestinations() {
  return db.all('SELECT * FROM remote_destinations ORDER BY created_at').map(rowToPublic);
}

function destRow(id) {
  return db.get('SELECT * FROM remote_destinations WHERE id = ?', id) || null;
}

function getDestination(id, { includeSecret = false } = {}) {
  const row = destRow(id);
  if (!row) return null;
  const pub = rowToPublic(row);
  if (includeSecret) {
    try {
      pub.secret = JSON.parse(secrets.decrypt(row.secret_cipher));
    } catch {
      pub.secret = null;
    }
  }
  return pub;
}

function cleanUrl(raw, { label }) {
  const url = String(raw || '')
    .trim()
    .replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw err(400, `${label} must start with http:// or https://.`);
  return url;
}

function validateConfig(provider, config) {
  const c = config && typeof config === 'object' ? config : {};
  if (provider === 'nextcloud') {
    if (!String(c.url || '').trim()) throw err(400, 'A Nextcloud server URL is required.');
    if (!String(c.username || '').trim()) throw err(400, 'A Nextcloud username is required.');
    return {
      url: cleanUrl(c.url, { label: 'Nextcloud server URL' }),
      username: String(c.username).trim(),
      folder: String(c.folder || 'Minecraft-Backups').trim() || 'Minecraft-Backups',
    };
  }
  if (provider === 'dropbox' || provider === 'gdrive') {
    if (!String(c.clientId || '').trim())
      throw err(400, 'An OAuth client ID is required. Create an app with the provider first.');
    return {
      clientId: String(c.clientId).trim(),
      folder: String(c.folder || 'Minecraft-Backups').trim() || 'Minecraft-Backups',
    };
  }
  throw err(400, 'Unknown provider.');
}

function validateSecret(provider, secret) {
  const s = secret && typeof secret === 'object' ? secret : {};
  if (provider === 'nextcloud') {
    if (!String(s.password || '')) throw err(400, 'A Nextcloud app password is required.');
    return { password: String(s.password) };
  }
  // OAuth providers: the client secret authenticates this panel to the
  // provider; the refresh token arrives later via the authorize flow.
  if (!String(s.clientSecret || '')) throw err(400, 'An OAuth client secret is required.');
  const out = { clientSecret: String(s.clientSecret) };
  if (s.refreshToken) out.refreshToken = String(s.refreshToken);
  return out;
}

function createDestination({ name, provider, config, secret }, { actor = 'system' } = {}) {
  if (!PROVIDERS[provider]) throw err(400, 'Unknown provider.');
  const cleanName = String(name || '').trim();
  if (!cleanName) throw err(400, 'Give the destination a name first.');
  const cleanConfig = validateConfig(provider, config);
  const cleanSecret = secret ? validateSecret(provider, secret) : null;
  const id = `rem_${nanoid(8)}`;
  db.run(
    'INSERT INTO remote_destinations (id, name, provider, config_json, secret_cipher, auto_upload) VALUES (?, ?, ?, ?, ?, 0)',
    id,
    cleanName.slice(0, 80),
    provider,
    JSON.stringify(cleanConfig),
    cleanSecret ? secrets.encrypt(JSON.stringify(cleanSecret)) : null
  );
  recordEvent({
    actor,
    type: 'remote-created',
    summary: `Offsite destination connected: ${cleanName} (${PROVIDERS[provider].label}).`,
    details: { destinationId: id, provider },
  });
  return getDestination(id);
}

function updateDestination(id, { name, config, secret, autoUpload }, { actor = 'system' } = {}) {
  const row = destRow(id);
  if (!row) throw err(404, 'Destination not found');
  const sets = [];
  const params = [];
  if (name !== undefined) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw err(400, 'Give the destination a name first.');
    sets.push('name = ?');
    params.push(cleanName.slice(0, 80));
  }
  if (config !== undefined) {
    // Partial updates merge over the stored config (blank fields keep their
    // values) so an edit that only flips auto-upload cannot wipe the URL.
    let existing;
    try {
      existing = JSON.parse(row.config_json || '{}');
    } catch {
      existing = {};
    }
    if (!existing || typeof existing !== 'object') existing = {};
    sets.push('config_json = ?');
    params.push(JSON.stringify(validateConfig(row.provider, { ...existing, ...config })));
  }
  if (secret !== undefined) {
    const current = row.secret_cipher ? JSON.parse(secrets.decrypt(row.secret_cipher)) : {};
    const merged = { ...current, ...validateSecret(row.provider, { ...current, ...secret }) };
    sets.push('secret_cipher = ?');
    params.push(secrets.encrypt(JSON.stringify(merged)));
  }
  if (autoUpload !== undefined) {
    sets.push('auto_upload = ?');
    params.push(autoUpload ? 1 : 0);
  }
  if (!sets.length) return getDestination(id);
  db.run(`UPDATE remote_destinations SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
  const updated = getDestination(id);
  recordEvent({
    actor,
    type: 'remote-updated',
    summary: `Offsite destination updated: ${updated.name} (auto-upload ${updated.autoUpload ? 'on' : 'off'}).`,
    details: { destinationId: id },
  });
  return updated;
}

function deleteDestination(id, { actor = 'system' } = {}) {
  const row = destRow(id);
  if (!row) throw err(404, 'Destination not found');
  // Tracking rows cascade; the remote files themselves are left alone (the
  // destination may be gone for good - deleting strangers' data on disconnect
  // would be worse than orphaning it).
  db.run('DELETE FROM remote_destinations WHERE id = ?', id);
  recordEvent({
    actor,
    type: 'remote-deleted',
    summary: `Offsite destination removed: ${row.name}. Remote copies were left in place.`,
    details: { destinationId: id, provider: row.provider },
  });
  return { ok: true };
}

function secretOf(row) {
  if (!row || !row.secret_cipher) return null;
  try {
    return JSON.parse(secrets.decrypt(row.secret_cipher));
  } catch {
    throw err(
      409,
      'The stored credential cannot be decrypted. Re-enter it on the destination (rotating the secret key orphans old values).'
    );
  }
}

// ---- Nextcloud (WebDAV) ---------------------------------------------------

function ncPaths(row) {
  const config = JSON.parse(row.config_json || '{}');
  const base = String(config.url || '').replace(/\/+$/, '');
  const user = String(config.username || '');
  const folder = String(config.folder || 'Minecraft-Backups')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const root = `${base}/remote.php/dav/files/${encodeURIComponent(user)}`;
  return { root, folderUrl: folder ? `${root}/${folder}` : root, folderSuffix: folder };
}

function ncAuth(row, secret) {
  const config = JSON.parse(row.config_json || '{}');
  return { Authorization: `Basic ${Buffer.from(`${config.username}:${secret.password}`).toString('base64')}` };
}

async function ncRequest(row, method, url, { headers, body } = {}) {
  const secret = secretOf(row);
  if (!secret || !secret.password) throw err(409, 'This destination has no password yet. Edit it and save one.');
  const res = await fetch(url, {
    method,
    headers: { 'User-Agent': UA, ...ncAuth(row, secret), ...headers },
    body,
    ...withTimeout(CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Nextcloud is unreachable: ${e.message || e}.`);
  });
  return res;
}

async function ncEnsureFolder(row) {
  const { folderUrl } = ncPaths(row);
  const res = await ncRequest(row, 'MKCOL', folderUrl);
  // 201 created, 405 already there - anything else (notably 401/403) is real.
  if (res.status !== 201 && res.status !== 405) {
    if (res.status === 401 || res.status === 403)
      throw err(401, 'Nextcloud rejected the login. Check the username and app password.');
    throw err(502, `Nextcloud refused the folder (HTTP ${res.status}).`);
  }
}

// Streaming PUT needs the long transfer timeout, which ncRequest (control
// timeout) does not give it - so uploads bypass ncRequest after this point.
async function ncUploadStream(row, absPath, size, remoteName, { onProgress = () => {} } = {}) {
  const { folderUrl, folderSuffix } = ncPaths(row);
  await ncEnsureFolder(row);
  const secret = secretOf(row);
  const config = JSON.parse(row.config_json || '{}');
  const target = `${folderUrl}/${encodeURIComponent(remoteName)}`;
  const stream = fs.createReadStream(absPath);
  let sent = 0;
  stream.on('data', (chunk) => {
    sent += chunk.length;
    onProgress({ receivedBytes: sent, totalBytes: size });
  });
  const res = await fetch(target, {
    method: 'PUT',
    headers: {
      'User-Agent': UA,
      Authorization: `Basic ${Buffer.from(`${config.username}:${secret.password}`).toString('base64')}`,
      'Content-Length': String(size),
      'Content-Type': 'application/zip',
    },
    body: stream,
    duplex: 'half',
    ...withTimeout(TRANSFER_TIMEOUT_MS),
  }).catch((e) => {
    stream.destroy();
    throw err(502, `Nextcloud upload failed: ${e.message || e}.`);
  });
  stream.destroy();
  if (res.status !== 201 && res.status !== 204) {
    if (res.status === 401 || res.status === 403)
      throw err(401, 'Nextcloud rejected the login. Check the username and app password.');
    if (res.status === 507) throw err(507, 'Nextcloud is out of quota space for this upload.');
    throw err(502, `Nextcloud refused the upload (HTTP ${res.status}).`);
  }
  await res.arrayBuffer().catch(() => null);
  return `${folderSuffix ? `${folderSuffix}/` : ''}${remoteName}`;
}

async function ncDownload(row, remoteSuffix, tmpPath, { onProgress = () => {} } = {}) {
  const { root } = ncPaths(row);
  const secret = secretOf(row);
  const config = JSON.parse(row.config_json || '{}');
  const url = `${root}/${remoteSuffix.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Authorization: `Basic ${Buffer.from(`${config.username}:${secret.password}`).toString('base64')}`,
    },
    ...withTimeout(TRANSFER_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Nextcloud download failed: ${e.message || e}.`);
  });
  if (res.status === 404) throw err(404, 'That copy is no longer on Nextcloud.');
  if (!res.ok) throw err(502, `Nextcloud refused the download (HTTP ${res.status}).`);
  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  const counter = new (require('node:stream').Transform)({
    transform(chunk, enc, cb) {
      received += chunk.length;
      onProgress({ receivedBytes: received, totalBytes: total });
      cb(null, chunk);
    },
  });
  const { pipeline } = require('node:stream/promises');
  await pipeline(res.body, counter, fs.createWriteStream(tmpPath));
  return tmpPath;
}

async function ncDelete(row, remoteSuffix) {
  const { root } = ncPaths(row);
  const res = await ncRequest(
    row,
    'DELETE',
    `${root}/${remoteSuffix.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`
  );
  if (res.status !== 204 && res.status !== 404) throw err(502, `Nextcloud refused the delete (HTTP ${res.status}).`);
}

async function ncTest(row) {
  const { folderUrl } = ncPaths(row);
  const res = await ncRequest(row, 'PROPFIND', folderUrl, {
    headers: { Depth: '0', 'Content-Type': 'application/xml' },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/></d:prop></d:propfind>',
  });
  if (res.status === 207) return { ok: true, detail: 'Connected - folder reachable.' };
  if (res.status === 401 || res.status === 403)
    throw err(401, 'Nextcloud rejected the login. Check the username and app password.');
  if (res.status === 404) return { ok: true, detail: 'Connected - the folder will be created on first upload.' };
  throw err(502, `Nextcloud answered HTTP ${res.status}. Check the server URL.`);
}

// ---- Dropbox (OAuth) ------------------------------------------------------

const dbxTokens = new Map(); // destinationId -> { token, exp }

async function dbxToken(row) {
  const secret = secretOf(row);
  const config = JSON.parse(row.config_json || '{}');
  if (!secret || !secret.refreshToken)
    throw err(409, 'Dropbox is not authorized yet. Use Authorize on the destination first.');
  const cached = dbxTokens.get(row.id);
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: secret.refreshToken,
      client_id: config.clientId,
      client_secret: secret.clientSecret,
    }),
    ...withTimeout(CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Dropbox is unreachable: ${e.message || e}.`);
  });
  if (!res.ok) {
    dbxTokens.delete(row.id);
    throw err(401, 'Dropbox refused the refresh token. Re-authorize the destination.');
  }
  const data = await res.json();
  dbxTokens.set(row.id, { token: data.access_token, exp: Date.now() + (data.expires_in || 14400) * 1000 });
  return data.access_token;
}

function dbxFolder(row) {
  const config = JSON.parse(row.config_json || '{}');
  return `/${String(config.folder || 'Minecraft-Backups').replace(/^\/+|\/+$/g, '')}`;
}

async function dbxCall(token, host, apiPath, { arg, body, contentType } = {}) {
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': UA };
  if (arg !== undefined) headers['Dropbox-API-Arg'] = JSON.stringify(arg);
  if (contentType) headers['Content-Type'] = contentType;
  const res = await fetch(`https://${host}${apiPath}`, {
    method: 'POST',
    headers,
    body,
    ...withTimeout(body ? TRANSFER_TIMEOUT_MS : CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Dropbox call failed: ${e.message || e}.`);
  });
  return res;
}

async function dbxUpload(row, absPath, size, remoteName, { onProgress = () => {} } = {}) {
  const token = await dbxToken(row);
  const fullPath = `${dbxFolder(row)}/${remoteName}`;
  const commit = { path: fullPath, mode: 'add', autorename: true, mute: true };
  if (size <= DBX_SINGLE_MAX_BYTES) {
    const stream = fs.createReadStream(absPath);
    let sent = 0;
    stream.on('data', (c) => {
      sent += c.length;
      onProgress({ receivedBytes: sent, totalBytes: size });
    });
    try {
      const res = await dbxCall(token, 'content.dropboxapi.com', '/2/files/upload', {
        arg: commit,
        body: stream,
        contentType: 'application/octet-stream',
      });
      if (!res.ok) throw err(502, `Dropbox refused the upload (HTTP ${res.status}).`);
      await res.arrayBuffer().catch(() => null);
      return fullPath;
    } finally {
      stream.destroy();
    }
  }
  // Chunked session for big archives.
  const start = await dbxCall(token, 'content.dropboxapi.com', '/2/files/upload_session/start', {
    arg: { close: false },
  });
  if (!start.ok) throw err(502, `Dropbox refused the upload session (HTTP ${start.status}).`);
  const sessionId = (await start.json()).session_id;
  const fh = await fsp.open(absPath, 'r');
  let offset = 0;
  try {
    while (offset < size) {
      const len = Math.min(DBX_CHUNK_BYTES, size - offset);
      const { buffer } = await fh.read(Buffer.alloc(len), 0, len, offset);
      const last = offset + len >= size;
      if (last) break; // final chunk goes through finish below
      const res = await dbxCall(token, 'content.dropboxapi.com', '/2/files/upload_session/append_v2', {
        arg: { cursor: { session_id: sessionId, offset } },
        body: buffer,
        contentType: 'application/octet-stream',
      });
      if (!res.ok) throw err(502, `Dropbox upload stalled (HTTP ${res.status}).`);
      await res.arrayBuffer().catch(() => null);
      offset += len;
      onProgress({ receivedBytes: offset, totalBytes: size });
    }
    const tailLen = size - offset;
    const { buffer } = await fh.read(Buffer.alloc(tailLen), 0, tailLen, offset);
    const done = await dbxCall(token, 'content.dropboxapi.com', '/2/files/upload_session/finish', {
      arg: { cursor: { session_id: sessionId, offset }, commit },
      body: tailLen ? buffer : null,
      contentType: 'application/octet-stream',
    });
    if (!done.ok) throw err(502, `Dropbox could not finish the upload (HTTP ${done.status}).`);
    await done.arrayBuffer().catch(() => null);
    onProgress({ receivedBytes: size, totalBytes: size });
    return fullPath;
  } finally {
    await fh.close().catch(() => {});
  }
}

async function dbxDownload(row, remotePath, tmpPath, { onProgress = () => {} } = {}) {
  const token = await dbxToken(row);
  const res = await dbxCall(token, 'content.dropboxapi.com', '/2/files/download', { arg: { path: remotePath } });
  if (res.status === 409) throw err(404, 'That copy is no longer on Dropbox.');
  if (!res.ok) throw err(502, `Dropbox refused the download (HTTP ${res.status}).`);
  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  const counter = new (require('node:stream').Transform)({
    transform(chunk, enc, cb) {
      received += chunk.length;
      onProgress({ receivedBytes: received, totalBytes: total });
      cb(null, chunk);
    },
  });
  const { pipeline } = require('node:stream/promises');
  await pipeline(res.body, counter, fs.createWriteStream(tmpPath));
  return tmpPath;
}

async function dbxDelete(row, remotePath) {
  const token = await dbxToken(row);
  const res = await dbxCall(token, 'api.dropboxapi.com', '/2/files/delete_v2', {
    arg: { path: remotePath },
    contentType: 'application/json',
    body: JSON.stringify({ path: remotePath }),
  });
  if (res.status === 409) return; // already gone counts as deleted
  if (!res.ok) throw err(502, `Dropbox refused the delete (HTTP ${res.status}).`);
}

async function dbxTest(row) {
  const token = await dbxToken(row);
  const res = await dbxCall(token, 'api.dropboxapi.com', '/2/users/get_current_account', {});
  if (!res.ok) throw err(502, `Dropbox answered HTTP ${res.status}.`);
  const me = await res.json().catch(() => ({}));
  return { ok: true, detail: `Connected${me.name ? ` as ${me.name.display_name || me.email || ''}` : ''}.` };
}

// ---- Google Drive (OAuth) -------------------------------------------------

const gTokens = new Map(); // destinationId -> { token, exp }

async function gToken(row) {
  const secret = secretOf(row);
  const config = JSON.parse(row.config_json || '{}');
  if (!secret || !secret.refreshToken)
    throw err(409, 'Google Drive is not authorized yet. Use Authorize on the destination first.');
  const cached = gTokens.get(row.id);
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: secret.refreshToken,
      client_id: config.clientId,
      client_secret: secret.clientSecret,
    }),
    ...withTimeout(CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Google is unreachable: ${e.message || e}.`);
  });
  if (!res.ok) {
    gTokens.delete(row.id);
    throw err(401, 'Google refused the refresh token. Re-authorize the destination.');
  }
  const data = await res.json();
  gTokens.set(row.id, { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 });
  return data.access_token;
}

async function gUpload(row, absPath, size, remoteName, { onProgress = () => {} } = {}) {
  const token = await gToken(row);
  const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': UA,
    },
    body: JSON.stringify({ name: remoteName, mimeType: 'application/zip' }),
    ...withTimeout(CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Google Drive upload failed to start: ${e.message || e}.`);
  });
  if (!init.ok) throw err(502, `Google Drive refused the upload (HTTP ${init.status}).`);
  const sessionUri = init.headers.get('location');
  if (!sessionUri) throw err(502, 'Google Drive gave no upload session.');
  const fh = await fsp.open(absPath, 'r');
  try {
    let offset = 0;
    let fileId = null;
    while (offset < size) {
      const len = Math.min(GDRIVE_CHUNK_BYTES, size - offset);
      const { buffer } = await fh.read(Buffer.alloc(len), 0, len, offset);
      const end = offset + len - 1;
      const res = await fetch(sessionUri, {
        method: 'PUT',
        headers: { 'Content-Length': String(len), 'Content-Range': `bytes ${offset}-${end}/${size}` },
        body: buffer,
        ...withTimeout(TRANSFER_TIMEOUT_MS),
      }).catch((e) => {
        throw err(502, `Google Drive upload stalled: ${e.message || e}.`);
      });
      if (res.status === 308) {
        offset += len;
        onProgress({ receivedBytes: offset, totalBytes: size });
        continue;
      }
      if (!res.ok) throw err(502, `Google Drive refused the upload (HTTP ${res.status}).`);
      fileId = (await res.json().catch(() => ({}))).id || null;
      offset = size;
      onProgress({ receivedBytes: size, totalBytes: size });
    }
    if (!fileId) throw err(502, 'Google Drive finished without a file id.');
    return fileId;
  } finally {
    await fh.close().catch(() => {});
  }
}

async function gDownload(row, fileId, tmpPath, { onProgress = () => {} } = {}) {
  const token = await gToken(row);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
    ...withTimeout(TRANSFER_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Google Drive download failed: ${e.message || e}.`);
  });
  if (res.status === 404) throw err(404, 'That copy is no longer on Google Drive.');
  if (!res.ok) throw err(502, `Google Drive refused the download (HTTP ${res.status}).`);
  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  const counter = new (require('node:stream').Transform)({
    transform(chunk, enc, cb) {
      received += chunk.length;
      onProgress({ receivedBytes: received, totalBytes: total });
      cb(null, chunk);
    },
  });
  const { pipeline } = require('node:stream/promises');
  await pipeline(res.body, counter, fs.createWriteStream(tmpPath));
  return tmpPath;
}

async function gDelete(row, fileId) {
  const token = await gToken(row);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
    ...withTimeout(CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Google Drive call failed: ${e.message || e}.`);
  });
  if (res.status === 404) return;
  if (!res.ok && res.status !== 204) throw err(502, `Google Drive refused the delete (HTTP ${res.status}).`);
}

async function gTest(row) {
  const token = await gToken(row);
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
    ...withTimeout(CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Google is unreachable: ${e.message || e}.`);
  });
  if (!res.ok) throw err(502, `Google Drive answered HTTP ${res.status}.`);
  const me = await res.json().catch(() => ({}));
  const who = (me.user && (me.user.displayName || me.user.emailAddress)) || '';
  return { ok: true, detail: `Connected${who ? ` as ${who}` : ''}.` };
}

// ---- Provider dispatch ----------------------------------------------------

async function uploadFile(dest, absPath, size, remoteName, opts = {}) {
  const row = typeof dest === 'string' ? destRow(dest) : dest;
  if (!row) throw err(404, 'Destination not found');
  if (row.provider === 'nextcloud') return ncUploadStream(row, absPath, size, remoteName, opts);
  if (row.provider === 'dropbox') return dbxUpload(row, absPath, size, remoteName, opts);
  if (row.provider === 'gdrive') return gUpload(row, absPath, size, remoteName, opts);
  throw err(400, 'Unknown provider.');
}

async function downloadFile(dest, remotePath, tmpPath, opts = {}) {
  const row = typeof dest === 'string' ? destRow(dest) : dest;
  if (!row) throw err(404, 'Destination not found');
  if (!remotePath) throw err(404, 'That copy was never uploaded.');
  if (row.provider === 'nextcloud') return ncDownload(row, remotePath, tmpPath, opts);
  if (row.provider === 'dropbox') return dbxDownload(row, remotePath, tmpPath, opts);
  if (row.provider === 'gdrive') return gDownload(row, remotePath, tmpPath, opts);
  throw err(400, 'Unknown provider.');
}

async function deleteRemoteFile(dest, remotePath) {
  const row = typeof dest === 'string' ? destRow(dest) : dest;
  if (!row || !remotePath) return;
  if (row.provider === 'nextcloud') return ncDelete(row, remotePath);
  if (row.provider === 'dropbox') return dbxDelete(row, remotePath);
  if (row.provider === 'gdrive') return gDelete(row, remotePath);
}

async function testConnection(id) {
  const row = destRow(id);
  if (!row) throw err(404, 'Destination not found');
  if (row.provider === 'nextcloud') return ncTest(row);
  if (row.provider === 'dropbox') return dbxTest(row);
  if (row.provider === 'gdrive') return gTest(row);
  throw err(400, 'Unknown provider.');
}

// ---- Upload engine ----------------------------------------------------------

function filesForBackup(backupId) {
  return db.all(
    `SELECT f.*, d.name AS destination_name, d.provider FROM remote_backup_files f
     JOIN remote_destinations d ON d.id = f.destination_id WHERE f.backup_id = ? ORDER BY f.updated_at DESC`,
    backupId
  );
}

/** Remote copies for many backups at once (one query for the backups page). */
function filesForBackups(backupIds) {
  if (!backupIds.length) return new Map();
  const ph = backupIds.map(() => '?').join(',');
  const out = new Map(backupIds.map((id) => [id, []]));
  for (const r of db.all(
    `SELECT f.backup_id, f.destination_id, f.status, f.size_bytes, f.updated_at,
            d.name AS destination_name, d.provider
       FROM remote_backup_files f
       JOIN remote_destinations d ON d.id = f.destination_id
      WHERE f.backup_id IN (${ph}) ORDER BY f.updated_at DESC`,
    ...backupIds
  )) {
    out.get(r.backup_id).push({
      destinationId: r.destination_id,
      destinationName: r.destination_name,
      provider: r.provider,
      status: r.status,
    });
  }
  return out;
}

function markFile(backupId, destinationId, status, { size = null, error = '' } = {}) {
  db.run(
    `INSERT INTO remote_backup_files (backup_id, destination_id, status, size_bytes, error, updated_at)
     VALUES (?, ?, ?, COALESCE(?, 0), ?, datetime('now'))
     ON CONFLICT(backup_id, destination_id) DO UPDATE SET
       status = excluded.status, size_bytes = excluded.size_bytes,
       error = excluded.error, updated_at = datetime('now')`,
    backupId,
    destinationId,
    status,
    size,
    String(error || '').slice(0, 500)
  );
}

function remoteNameFor(backup) {
  return backup.filename;
}

async function doUpload(backupId, destinationId, { actor = 'system', task = null } = {}) {
  const backup = db.get('SELECT * FROM backups WHERE id = ?', backupId);
  if (!backup) throw err(404, 'Backup not found');
  const dest = destRow(destinationId);
  if (!dest) throw err(404, 'Destination not found');
  const abs = dataPath(backup.rel_path);
  const stat = await fsp.stat(abs).catch(() => null);
  if (!stat || !stat.isFile()) {
    markFile(backupId, destinationId, 'failed', { error: 'Local archive is missing.' });
    throw err(410, 'The local archive is missing, so there is nothing to upload.');
  }
  markFile(backupId, destinationId, 'uploading', { size: stat.size });
  const step = (label) => {
    if (task) task.step(label);
  };
  const progress = ({ receivedBytes, totalBytes }) => {
    if (task) task.progress(receivedBytes, totalBytes || stat.size);
  };
  step(`Uploading to ${dest.name}…`);
  try {
    const remotePath = await uploadFile(dest, abs, stat.size, remoteNameFor(backup), {
      onProgress: progress,
    });
    db.run(
      `UPDATE remote_backup_files SET status = 'done', size_bytes = ?, error = '',
         remote_path = ?, updated_at = datetime('now') WHERE backup_id = ? AND destination_id = ?`,
      stat.size,
      remotePath,
      backupId,
      destinationId
    );
    recordEvent({
      serverId: backup.server_id,
      actor,
      type: 'backup-uploaded',
      summary: `Backup uploaded offsite: ${backup.filename} to ${dest.name}.`,
      details: { backupId, destinationId, provider: dest.provider, sizeBytes: stat.size },
    });
    logger.info('Uploaded a backup offsite.', {
      serverId: backup.server_id,
      backupId,
      destination: dest.name,
      sizeBytes: stat.size,
    });
    return { ok: true, remotePath };
  } catch (e) {
    markFile(backupId, destinationId, 'failed', { error: (e && e.message) || String(e) });
    recordEvent({
      serverId: backup.server_id,
      actor,
      type: 'backup-upload-failed',
      summary: `Offsite upload failed: ${backup.filename} to ${dest.name}.`,
      details: { backupId, destinationId, error: (e && e.message) || String(e) },
    });
    logger.warn('An offsite backup upload failed.', {
      serverId: backup.server_id,
      backupId,
      destination: dest.name,
      err: serializeError(e),
    });
    throw e;
  }
}

/** Fire-and-forget fan-out after a backup completes. Never throws. */
function enqueueUpload(backupRow) {
  try {
    if (!backupRow || !backupRow.id) return;
    const dests = db.all('SELECT * FROM remote_destinations WHERE auto_upload = 1');
    if (!dests.length) return;
    const tasks = require('./tasks');
    for (const dest of dests) {
      markFile(backupRow.id, dest.id, 'pending');
      tasks.run(`Uploading backup to ${dest.name}`, { actor: 'system' }, async (t) =>
        doUpload(backupRow.id, dest.id, { actor: 'system', task: t })
      );
    }
  } catch (e) {
    logger.error('Queueing offsite uploads failed.', { err: serializeError(e) });
  }
}

/** Explicit per-archive upload with progress. Returns a task id. */
function startUploadTask(backupId, destinationId, { actor = 'system' } = {}) {
  const backup = db.get('SELECT * FROM backups WHERE id = ?', backupId);
  if (!backup) throw err(404, 'Backup not found');
  if (!destRow(destinationId)) throw err(404, 'Destination not found');
  markFile(backupId, destinationId, 'pending');
  const tasks = require('./tasks');
  return tasks.run(`Uploading backup to ${destRow(destinationId).name}`, { actor }, async (t) =>
    doUpload(backupId, destinationId, { actor, task: t })
  );
}

/** Download a tracked remote copy into a temp file for restore. */
async function downloadForRestore(backupId, destinationId, { actor = 'system', task = null } = {}) {
  let row;
  if (destinationId) {
    row = db.get(
      `SELECT f.*, d.name AS destination_name, d.provider FROM remote_backup_files f
       JOIN remote_destinations d ON d.id = f.destination_id
       WHERE f.backup_id = ? AND f.destination_id = ? AND f.status = 'done'`,
      backupId,
      destinationId
    );
    if (!row) throw err(404, 'No finished upload of this backup on that destination.');
  } else {
    row = db.get(
      `SELECT f.*, d.name AS destination_name, d.provider FROM remote_backup_files f
       JOIN remote_destinations d ON d.id = f.destination_id
       WHERE f.backup_id = ? AND f.status = 'done' ORDER BY f.updated_at DESC`,
      backupId
    );
    if (!row) throw err(404, 'This backup has no finished offsite copy.');
  }
  const dest = destRow(row.destination_id);
  const tmp = dataPath('tmp', `remote-restore-${nanoid(6)}.zip`);
  if (task) task.step(`Downloading from ${row.destination_name}…`);
  await downloadFile(
    dest,
    row.remote_path,
    tmp,
    task
      ? {
          onProgress: ({ receivedBytes, totalBytes }) => task.progress(receivedBytes, totalBytes || row.size_bytes),
        }
      : {}
  );
  recordEvent({
    actor,
    type: 'backup-downloaded',
    summary: `Backup downloaded from offsite storage (${row.destination_name}).`,
    details: { backupId, destinationId: row.destination_id },
  });
  return { tmpPath: tmp, destinationName: row.destination_name };
}

// ---- OAuth (Dropbox + Google Drive) -----------------------------------------

function oauthAuthorizeUrl(provider, dest, redirectUri, state) {
  const config = JSON.parse(dest.config_json || '{}');
  if (!config.clientId) throw err(400, 'This destination has no OAuth client ID yet. Edit it and save one.');
  if (provider === 'dropbox') {
    const u = new URL('https://www.dropbox.com/oauth2/authorize');
    u.searchParams.set('client_id', config.clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('token_access_type', 'offline');
    u.searchParams.set('state', state);
    return u.toString();
  }
  if (provider === 'gdrive') {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.searchParams.set('client_id', config.clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file');
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('prompt', 'consent');
    u.searchParams.set('state', state);
    return u.toString();
  }
  throw err(400, 'This provider needs no browser authorization.');
}

function beginOAuth(id) {
  const row = destRow(id);
  if (!row) throw err(404, 'Destination not found');
  if (!PROVIDERS[row.provider] || !PROVIDERS[row.provider].oauth)
    throw err(400, 'This provider needs no browser authorization.');
  const state = nanoid(24);
  db.run(
    "UPDATE remote_destinations SET oauth_state = ?, oauth_state_expires_at = datetime('now', '+10 minutes') WHERE id = ?",
    state,
    id
  );
  return { state };
}

async function finishOAuth(id, state, code, redirectUri) {
  const row = destRow(id);
  if (!row) throw err(404, 'Destination not found');
  if (!row.oauth_state || row.oauth_state !== state)
    throw err(400, 'Authorization expired or already used. Start over from the destination.');
  const expired = db.get(
    "SELECT 1 AS x WHERE datetime('now') > (SELECT oauth_state_expires_at FROM remote_destinations WHERE id = ?)",
    id
  );
  if (expired) throw err(400, 'Authorization expired. Start over from the destination.');
  const config = JSON.parse(row.config_json || '{}');
  const secret = row.secret_cipher ? JSON.parse(secrets.decrypt(row.secret_cipher)) : {};
  const tokenUrl =
    row.provider === 'dropbox' ? 'https://api.dropboxapi.com/oauth2/token' : 'https://oauth2.googleapis.com/token';
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: secret.clientSecret || '',
      redirect_uri: redirectUri,
    }),
    ...withTimeout(CONTROL_TIMEOUT_MS),
  }).catch((e) => {
    throw err(502, `Authorization failed: ${e.message || e}.`);
  });
  if (!res.ok) throw err(502, 'The provider refused the authorization code. Start over from the destination.');
  const data = await res.json().catch(() => ({}));
  if (!data.refresh_token) throw err(502, 'The provider gave no reusable credential. Start over from the destination.');
  secret.refreshToken = data.refresh_token;
  db.run(
    'UPDATE remote_destinations SET secret_cipher = ?, oauth_state = NULL, oauth_state_expires_at = NULL WHERE id = ?',
    secrets.encrypt(JSON.stringify(secret)),
    id
  );
  dbxTokens.delete(id);
  gTokens.delete(id);
  const updated = getDestination(id);
  recordEvent({
    actor: 'system',
    type: 'remote-authorized',
    summary: `Offsite destination authorized: ${updated.name}.`,
    details: { destinationId: id, provider: row.provider },
  });
  return updated;
}

module.exports = {
  PROVIDERS,
  listDestinations,
  getDestination,
  createDestination,
  updateDestination,
  deleteDestination,
  testConnection,
  uploadFile,
  downloadFile,
  deleteRemoteFile,
  filesForBackup,
  filesForBackups,
  markFile,
  doUpload,
  enqueueUpload,
  startUploadTask,
  downloadForRestore,
  beginOAuth,
  finishOAuth,
  oauthAuthorizeUrl,
};
