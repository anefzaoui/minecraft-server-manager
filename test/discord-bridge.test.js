'use strict';

// The event bridge must not drop a mapped alert when a single webhook POST
// fails transiently: the high-water mark stays put and the row is retried on
// the next poll (bounded, so a permanently-dead webhook can't wedge it).

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const discord = require('../src/integrations/discord');
const { recordEvent } = require('../src/events');

function seedServer(id) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, ?, 'PAPER', 25650, 26650, 'x', 1024, 1536, 'running')`,
    id,
    'Bridge Test'
  );
}

test('a transient webhook failure retries the row instead of skipping the alert', async (t) => {
  const id = 'srv_bridge';
  seedServer(id);
  await discord.setConfig(id, {
    enabled: true,
    webhookUrl: 'https://discord.com/api/webhooks/123456789/AbcDefToken',
    events: {},
  });

  const calls = [];
  let failNext = true;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    if (failNext) {
      failNext = false;
      throw new Error('network blip');
    }
    return { ok: true, status: 204 };
  });

  recordEvent({ serverId: id, type: 'oom', summary: 'Server ran out of memory.' });

  // First poll: the POST throws -> notify() returns false -> the row is held.
  await discord._pollOnce();
  // Second poll: the same row is retried and now succeeds.
  await discord._pollOnce();

  const oomPosts = calls.length;
  assert.ok(oomPosts >= 2, `expected the failed alert to be retried, saw ${oomPosts} POST(s)`);

  // Third poll: nothing new, no further POSTs.
  const before = calls.length;
  await discord._pollOnce();
  assert.equal(calls.length, before, 'a delivered row is not re-sent');
});

test('the boot mark replays events after the persisted mark, but not older than the window', () => {
  const settings = require('../src/services/settings');
  seedServer('srv_mark');

  // Simulate: the bridge last persisted mark 5, then the panel was down while
  // events 6..N were recorded.
  settings.set(discord._MARK_KEY, 5);
  const recent = [];
  for (let i = 0; i < 4; i++) {
    recent.push(recordEvent({ serverId: 'srv_mark', type: 'oom', summary: `blip ${i}` }));
  }
  const maxId = db.get('SELECT MAX(id) AS id FROM events').id;

  // Nothing is older than the replay window in this fresh test DB, so replay
  // resumes exactly from the persisted mark.
  assert.equal(discord._initialMark(), 5);

  // Age every existing event past the window: now there is nothing left to
  // replay and the mark jumps to the tip.
  db.run(`UPDATE events SET created_at = datetime('now', '-1 day')`);
  assert.equal(discord._initialMark(), maxId);

  // First run ever (no persisted mark): start at the tip, never replay history.
  settings.remove(discord._MARK_KEY);
  assert.equal(discord._initialMark(), maxId);
  void recent;
});
