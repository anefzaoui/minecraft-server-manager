'use strict';

// In-process integration harness: boots the real Express app against a
// throwaway DB (no Docker, no background services), creates a first admin, and
// exposes a small request helper. createApp() only wires routes/middleware — the
// background services live in server.js — so this is safe to run headless.

require('./env');
const { migrate } = require('../../src/db/migrate');
migrate();
const { createApp } = require('../../src/web/app');

let server = null;
let base = '';

async function start() {
  if (server) return base;
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}

async function stop() {
  if (server) await new Promise((r) => server.close(r));
  server = null;
}

async function req(method, path, { body, cookie, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response (CSV, redirect, …) */
  }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, json, text, setCookie };
}

/** Create the first admin (first-run) and return its session cookie string. */
async function adminCookie() {
  const r = await req('POST', '/setup', { body: { username: 'admin', password: 'supersecret123' } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

/** Insert a minimal server row directly (no Docker) and return its id. */
function seedServer(id = 'srv_test01') {
  const db = require('../../src/db');
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, ?, 'PAPER', 25599, 26599, 'x', 1024, 1536)`,
    id,
    'Test Server'
  );
  return id;
}

module.exports = { start, stop, req, adminCookie, seedServer };
