'use strict';

// Long-operation tracking: every slow job (pack install/upgrade, image pull,
// downloads, backups, world ops, blueprint import) runs as a registered task
// the UI polls for real progress — no more fake pulse bars.

const { nanoid } = require('nanoid');

const tasks = new Map(); // id -> task
const TTL_MS = 10 * 60 * 1000; // finished tasks linger for late polls

/**
 * createTask('Installing pack …', {serverId}) → task handle:
 *   t.step('Downloading mods')          — set the current step label
 *   t.progress(received, total)         — numeric progress for the active step
 *   t.log('…')                          — append a detail line (kept last 50)
 *   t.done(result) / t.fail(error)      — finish
 * run(title, opts, fn) wraps a promise-returning fn with automatic done/fail.
 */
function createTask(title, { serverId = null, actor = 'system' } = {}) {
  const id = `task_${nanoid(10)}`;
  const task = {
    id,
    title,
    serverId,
    actor,
    state: 'running', // running | done | failed
    stepLabel: 'Starting…',
    current: 0,
    total: 0,
    logs: [],
    result: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  };
  tasks.set(id, task);

  const handle = {
    id,
    step(label) {
      task.stepLabel = label;
      task.current = 0;
      task.total = 0;
    },
    progress(current, total = 0) {
      task.current = current;
      task.total = total;
    },
    log(line) {
      task.logs.push(String(line).slice(0, 300));
      if (task.logs.length > 50) task.logs.shift();
    },
    done(result = null) {
      task.state = 'done';
      task.result = result;
      task.finishedAt = Date.now();
      scheduleCleanup(id);
    },
    fail(error) {
      task.state = 'failed';
      task.error = error && error.message ? error.message : String(error);
      const extra = {};
      if (error && error.requiresForce) extra.requiresForce = true;
      if (error && error.requiresVersionConfirm) {
        extra.requiresVersionConfirm = true;
        if (error.fromVersion) extra.fromVersion = error.fromVersion;
        if (error.toVersion) extra.toVersion = error.toVersion;
      }
      task.extra = Object.keys(extra).length ? extra : undefined;
      task.finishedAt = Date.now();
      scheduleCleanup(id);
    },
  };
  return handle;
}

/** Fire-and-track: returns the task id immediately; fn runs in background. */
function run(title, opts, fn) {
  const t = createTask(title, opts);
  Promise.resolve()
    .then(() => fn(t))
    .then((result) => t.done(result))
    .catch((err) => {
      console.error(`[task] ${title}:`, err.message);
      t.fail(err);
    });
  return t.id;
}

function getTask(id) {
  const t = tasks.get(id);
  if (!t) return null;
  return {
    id: t.id,
    title: t.title,
    serverId: t.serverId,
    state: t.state,
    step: t.stepLabel,
    current: t.current,
    total: t.total,
    percent: t.total ? Math.min(100, Math.round((t.current / t.total) * 100)) : null,
    logs: t.logs.slice(-10),
    result: t.result,
    error: t.error,
    ...(t.extra || {}),
    elapsedMs: (t.finishedAt || Date.now()) - t.startedAt,
  };
}

function scheduleCleanup(id) {
  setTimeout(() => tasks.delete(id), TTL_MS).unref();
}

/** Active (running) tasks + very recent finishers, for the global task tray. */
function listTasks() {
  const out = [];
  for (const t of tasks.values()) {
    if (t.state === 'running' || Date.now() - (t.finishedAt || 0) < 15000) {
      out.push(getTask(t.id));
    }
  }
  return out.sort((a, b) => (a.state === 'running' ? -1 : 1) - (b.state === 'running' ? -1 : 1));
}

module.exports = { createTask, run, getTask, listTasks };
