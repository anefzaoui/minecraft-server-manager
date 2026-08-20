'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const raw = require('./fixtures/gtnh-versions.json');
const { migrate } = require('../src/db/migrate');
const db = require('../src/db');
const gtnh = require('../src/services/gtnhApi');

// Initialize database for async tests
migrate();

test('normalizeIndex preserves the index order (newest first)', () => {
  const entries = gtnh.normalizeIndex(raw);
  assert.deepEqual(
    entries.map((e) => e.version),
    ['2.9.0-beta-2', '2.8.4', '2.7.4', '2.4.0', '9.9.9-synthetic-nojava', '9.9.8-synthetic-badlink']
  );
});

test('normalizeIndex maps title to a channel', () => {
  const byVersion = Object.fromEntries(gtnh.normalizeIndex(raw).map((e) => [e.version, e]));
  assert.equal(byVersion['2.9.0-beta-2'].channel, 'beta');
  assert.equal(byVersion['2.8.4'].channel, 'stable');
});

test('normalizeIndex carries maxJavaVersion, null when absent', () => {
  const byVersion = Object.fromEntries(gtnh.normalizeIndex(raw).map((e) => [e.version, e]));
  assert.equal(byVersion['2.8.4'].maxJavaVersion, 25);
  assert.equal(byVersion['2.7.4'].maxJavaVersion, 21);
  assert.equal(byVersion['9.9.9-synthetic-nojava'].maxJavaVersion, null);
});

test('normalizeIndex accepts only https github changelog links', () => {
  const byVersion = Object.fromEntries(gtnh.normalizeIndex(raw).map((e) => [e.version, e]));
  assert.match(byVersion['2.8.4'].changelogUrl, /^https:\/\/github\.com\//);
  assert.equal(byVersion['9.9.8-synthetic-badlink'].changelogUrl, null);
});

test('normalizeIndex tolerates junk input', () => {
  assert.deepEqual(gtnh.normalizeIndex(null), []);
  assert.deepEqual(gtnh.normalizeIndex('nope'), []);
});

test('filterVersions hides betas unless asked', () => {
  const entries = gtnh.normalizeIndex(raw);
  assert.equal(
    gtnh.filterVersions(entries, { includeBeta: false }).some((e) => e.channel === 'beta'),
    false
  );
  assert.equal(gtnh.filterVersions(entries, { includeBeta: true }).length, entries.length);
});

test('pickLatest respects the channel filter', () => {
  const entries = gtnh.normalizeIndex(raw);
  assert.equal(gtnh.pickLatest(entries, { includeBeta: false }).version, '2.8.4');
  assert.equal(gtnh.pickLatest(entries, { includeBeta: true }).version, '2.9.0-beta-2');
  assert.equal(gtnh.pickLatest([], { includeBeta: true }), null);
});

// ---- Async: fetchIndex + caching behavior ----------------------------------

test('fresh cache is served without any fetch', async () => {
  // Seed cache with recent timestamp
  const now = new Date().toISOString().slice(0, 19);
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'gtnh:versions',
    JSON.stringify(raw),
    now
  );

  const originalFetch = globalThis.fetch;
  const mockCalls = [];
  globalThis.fetch = () => {
    mockCalls.push(1);
    throw new Error('fetch should not be called');
  };
  try {
    const entries = await gtnh.listVersions();
    assert.equal(entries.length, 5); // stable only
    assert.equal(mockCalls.length, 0); // fetch was never called
  } finally {
    globalThis.fetch = originalFetch;
    db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');
  }
});

test('network failure serves the stale cache', async () => {
  // Seed cache with old timestamp (older than 30-minute TTL)
  const oldTime = new Date(Date.now() - 31 * 60 * 1000).toISOString().slice(0, 19);
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'gtnh:versions',
    JSON.stringify(raw),
    oldTime
  );

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    throw new Error('Network unreachable');
  };
  try {
    const entries = await gtnh.listVersions();
    assert.equal(entries.length, 5); // returns stale cache
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');
  }
});

test('non-ok response serves the stale cache', async () => {
  // Seed cache with old timestamp
  const oldTime = new Date(Date.now() - 31 * 60 * 1000).toISOString().slice(0, 19);
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'gtnh:versions',
    JSON.stringify(raw),
    oldTime
  );

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    return { ok: false, status: 503 };
  };
  try {
    const entries = await gtnh.listVersions();
    assert.equal(entries.length, 5); // returns stale cache
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');
  }
});

test('no cache and an unreachable index throws a 502', async () => {
  db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    throw new Error('Network error');
  };
  try {
    await assert.rejects(
      () => gtnh.listVersions(),
      (err) => err.status === 502 && /Could not reach/.test(err.message)
    );
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getVersion throws 404 for a key not in the index', async () => {
  const now = new Date().toISOString().slice(0, 19);
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'gtnh:versions',
    JSON.stringify(raw),
    now
  );

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    throw new Error('fetch should not be called');
  };
  try {
    await assert.rejects(
      () => gtnh.getVersion('99.99.99-nonexistent'),
      (err) => err.status === 404 && /Unknown GTNH pack version/.test(err.message)
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');
  }
});

test('a successful fetch writes the cache', async () => {
  db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    return {
      ok: true,
      json: async () => raw,
    };
  };
  try {
    const entries = await gtnh.listVersions();
    assert.equal(entries.length, 5); // stable only
    assert.equal(fetchCalls, 1);

    // Verify cache was written
    const cached = db.get('SELECT value_json FROM api_cache WHERE key = ?', 'gtnh:versions');
    assert.ok(cached);
    const cached_raw = JSON.parse(cached.value_json);
    assert.deepEqual(Object.keys(cached_raw), Object.keys(raw));
  } finally {
    globalThis.fetch = originalFetch;
    db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');
  }
});

test('malformed JSON response serves stale cache or throws 502', async () => {
  db.run('DELETE FROM api_cache WHERE key = ?', 'gtnh:versions');

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    return {
      ok: true,
      json: async () => {
        throw new Error('Unexpected token <');
      },
    };
  };
  try {
    await assert.rejects(
      () => gtnh.listVersions(),
      (err) => err.status === 502 && /malformed JSON/.test(err.message)
    );
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
