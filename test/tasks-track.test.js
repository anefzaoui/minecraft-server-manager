'use strict';

// tasks.track: work a caller awaits itself still shows in the tray while it runs.

const test = require('node:test');
const assert = require('node:assert/strict');
const { track, listTasks } = require('../src/services/tasks');

const find = (title) => listTasks().find((t) => t.title === title);

test('a tracked task is running in the tray while it works, then done', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const pending = track('Tracking ok…', { actor: 'tester' }, async (t) => {
    t.step('Working…');
    await gate;
    return 42;
  });
  assert.equal(find('Tracking ok…').state, 'running');
  assert.equal(find('Tracking ok…').step, 'Working…');
  release();
  assert.equal(await pending, 42, "the caller still gets fn's result");
  assert.equal(find('Tracking ok…').state, 'done');
});

test('a tracked task that throws is marked failed and the error reaches the caller', async () => {
  await assert.rejects(
    () =>
      track('Tracking bad…', {}, async () => {
        throw new Error('boom');
      }),
    /boom/
  );
  const t = find('Tracking bad…');
  assert.equal(t.state, 'failed');
  assert.equal(t.error, 'boom');
});

test('running tasks sort ahead of finished ones', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  await track('Tracking earlier…', {}, async () => {});
  const pending = track('Tracking later…', {}, () => gate);
  const titles = listTasks().map((t) => t.title);
  assert.ok(titles.indexOf('Tracking later…') < titles.indexOf('Tracking earlier…'));
  release();
  await pending;
});
