'use strict';

// Ingest taps + backfill with the Docker log layer stubbed (set before require).

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const logs = require('../src/docker/logs');

let stream;
let stops = 0;
let fetched = '';
logs.followLogs = async () => {
  stream = new PassThrough();
  return {
    stream,
    stop: () => {
      stops++;
      stream.destroy();
    },
  };
};
logs.fetchLogs = async () => fetched;

const ingest = require('../src/analytics/ingest');

const SID = 'srv_ingtap';
const tick = () => new Promise((r) => setTimeout(r, 30));

test.before(() => {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, 'Ing', 'PAPER', 25777, 26777, 'x', 1024, 1536, 'running')`,
    SID
  );
});

test('a live tap records join/chat/leave lines, splitting across chunk boundaries', async () => {
  await ingest.startIngest();
  const line = (t, msg) => `2026-03-15T12:00:${t}.000Z [12:00:${t}] [Server thread/INFO]: ${msg}\n`;
  stream.write(line('01', 'Steve joined the game'));
  stream.write(line('03', 'Steve joined the game')); // deduped
  stream.write(line('02', '<Steve> hello there').slice(0, 20));
  stream.write(line('02', '<Steve> hello there').slice(20));
  stream.write('\n');
  stream.write(line('30', 'Steve left the game'));
  await tick();
  const events = db.all('SELECT type FROM player_events WHERE server_id = ? ORDER BY id', SID).map((e) => e.type);
  assert.deepEqual(events, ['join', 'chat', 'leave']);
  const s = db.get('SELECT * FROM player_sessions WHERE server_id = ?', SID);
  assert.ok(s.ended_at);
});

test('stream end drops the tap and closes open sessions', async () => {
  stream.write('2026-03-15T13:00:00.000Z [13:00:00] [Server thread/INFO]: Alex joined the game\n');
  await tick();
  assert.equal(db.get('SELECT COUNT(*) n FROM player_sessions WHERE server_id = ? AND ended_at IS NULL', SID).n, 1);
  stream.end();
  await tick();
  assert.equal(db.get('SELECT COUNT(*) n FROM player_sessions WHERE server_id = ? AND ended_at IS NULL', SID).n, 0);
});

test('stopIngest stops live taps', async () => {
  db.run("UPDATE servers SET status = 'running' WHERE id = ?", SID);
  await ingest.startIngest(); // re-attaches (the previous tap ended)
  const before = stops;
  ingest.stopIngest();
  assert.equal(stops, before + 1);
});

test('backfillFromLogs inserts new events once and skips duplicates and older lines', async () => {
  fetched = [
    '2026-04-01T10:00:00.000Z [10:00:00] [Server thread/INFO]: Bob joined the game',
    '2026-04-01T10:00:05.000Z [10:00:05] [Server thread/INFO]: <Bob> hi',
    'not an event',
    '',
  ].join('\n');
  assert.deepEqual(await ingest.backfillFromLogs(SID), { inserted: 2 });
  assert.deepEqual(await ingest.backfillFromLogs(SID), { inserted: 0 });
});
