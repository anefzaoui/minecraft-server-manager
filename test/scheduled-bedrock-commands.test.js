'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { migrate } = require('../src/db/migrate');

migrate();

const cronerPath = require.resolve('croner');
const schedulerPath = require.resolve('../src/services/scheduler');
const commandsPath = require.resolve('../src/services/consoleCommands');
const serversPath = require.resolve('../src/services/servers');

function replacement(path, exports) {
  const previous = require.cache[path];
  require.cache[path] = { id: path, filename: path, loaded: true, exports };
  return () => {
    if (previous) require.cache[path] = previous;
    else delete require.cache[path];
  };
}

async function withScheduledCommand({ sendConsoleCommand }, fn) {
  const callbacks = new Map();
  class FakeCron {
    constructor(_expression, _options, callback) {
      if (callback) callbacks.set(callbacks.size, callback);
    }
    stop() {}
    nextRun() {
      return new Date('2030-01-01T00:00:00.000Z');
    }
  }

  const restore = [
    replacement(cronerPath, { Cron: FakeCron }),
    replacement(commandsPath, { sendConsoleCommand }),
    replacement(serversPath, { getServer: () => ({ runtime: 'bedrock' }) }),
  ];
  delete require.cache[schedulerPath];
  try {
    return await fn(require(schedulerPath), callbacks);
  } finally {
    delete require.cache[schedulerPath];
    restore.reverse().forEach((undo) => undo());
  }
}

function eventsFor(serverId) {
  return db.all('SELECT type, summary FROM events WHERE server_id = ? ORDER BY created_at', serverId);
}

function seedBedrockServer(id) {
  db.run(
    `INSERT INTO servers (id, display_name, type, runtime, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, 'Scheduled Bedrock', 'BEDROCK', 'bedrock', 29132, 0, 'x', 1024, 1536)`,
    id
  );
}

test('a scheduled command for a Native Bedrock server is dispatched through its Bedrock console and recorded as fired', async () => {
  const serverId = 'sched_bedrock_success';
  let received;
  seedBedrockServer(serverId);
  await withScheduledCommand(
    {
      sendConsoleCommand: async (server, id, command) => {
        received = { server, id, command };
        return { source: 'bedrock-console', output: 'queued' };
      },
    },
    async (scheduler, callbacks) => {
      const schedule = scheduler.createSchedule({
        serverId,
        taskType: 'rcon',
        cron: '0 3 * * *',
        payload: { command: 'say scheduled hello' },
      });
      try {
        await callbacks.get(0)();
        assert.deepEqual(received, {
          server: { runtime: 'bedrock' },
          id: serverId,
          command: 'say scheduled hello',
        });
        assert.ok(eventsFor(serverId).some((event) => event.type === 'schedule-fired'));
        assert.ok(eventsFor(serverId).some((event) => event.type === 'bedrock-console'));
        assert.ok(!eventsFor(serverId).some((event) => event.type === 'schedule-failed'));
      } finally {
        scheduler.deleteSchedule(schedule.id);
      }
    }
  ).finally(() => db.run('DELETE FROM servers WHERE id = ?', serverId));
});

test('a failed Native Bedrock scheduled command is recorded as schedule-failed without using RCON', async () => {
  const serverId = 'sched_bedrock_failure';
  let attempted = false;
  seedBedrockServer(serverId);
  await withScheduledCommand(
    {
      sendConsoleCommand: async () => {
        attempted = true;
        throw new Error('Bedrock console command failed: process unavailable');
      },
    },
    async (scheduler, callbacks) => {
      const schedule = scheduler.createSchedule({
        serverId,
        taskType: 'rcon',
        cron: '0 3 * * *',
        payload: { command: 'say scheduled hello' },
      });
      try {
        await callbacks.get(0)();
        assert.equal(attempted, true);
        assert.ok(eventsFor(serverId).some((event) => event.type === 'schedule-fired'));
        assert.ok(eventsFor(serverId).some((event) => event.type === 'schedule-failed'));
      } finally {
        scheduler.deleteSchedule(schedule.id);
      }
    }
  ).finally(() => db.run('DELETE FROM servers WHERE id = ?', serverId));
});
