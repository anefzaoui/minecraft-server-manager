'use strict';

require('./helpers/app'); // runs migrate()
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { resolveProfile, uuidToDashed } = require('../src/services/mojangProfiles');

test.before(() => {
  db.run("DELETE FROM api_cache WHERE key LIKE 'mojang-profile:%'");
});
test.after(() => {
  db.run("DELETE FROM api_cache WHERE key LIKE 'mojang-profile:%'");
});

test('uuidToDashed formats a 32-hex UUID and rejects junk', () => {
  assert.equal(uuidToDashed('3f5f7c2a8a4e4a1a9c1b000000000001'), '3f5f7c2a-8a4e-4a1a-9c1b-000000000001');
  assert.equal(uuidToDashed('3f5f7c2a-8a4e-4a1a-9c1b-000000000001'), '3f5f7c2a-8a4e-4a1a-9c1b-000000000001'); // already dashed is tolerated
  assert.equal(uuidToDashed('nope'), null);
  assert.equal(uuidToDashed('3f5f7c2a8a4e4a1a9c1b0000000000zz'), null); // non-hex
});

test('resolveProfile fetches a fresh profile and caches it', async () => {
  let called = 0;
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    called++;
    assert.equal(url, 'https://api.mojang.com/users/profiles/minecraft/Notch');
    return {
      status: 200,
      ok: true,
      json: async () => ({ id: '069a79f444e94726a5befca90e38aaf5', name: 'Notch' }),
    };
  };
  try {
    const p = await resolveProfile('Notch');
    assert.deepEqual(p, { uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Notch' });
    assert.equal(called, 1);

    // cached second call - no network
    const again = await resolveProfile('notch'); // case-insensitive key
    assert.equal(again.uuid, '069a79f4-44e9-4726-a5be-fca90e38aaf5');
    assert.equal(called, 1);
  } finally {
    global.fetch = realFetch;
  }
});

test('resolveProfile returns null when Mojang 404s (unknown player)', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({ status: 404, ok: false });
  try {
    assert.equal(await resolveProfile('Nobody_Exists_12345'), null);
  } finally {
    global.fetch = realFetch;
  }
});

test('resolveProfile throws on network failure when nothing is cached, but serves stale when cached', async () => {
  const name = 'FlakyPlayer';
  // seed a stale cache row
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now', '-2 days'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'mojang-profile:' + name.toLowerCase(),
    JSON.stringify({ uuid: 'aaaa-bbbb', name: 'FlakyPlayer' })
  );

  const realFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };
  try {
    // stale cache served despite network failure
    const p = await resolveProfile(name);
    assert.equal(p.name, 'FlakyPlayer');
  } finally {
    global.fetch = realFetch;
  }

  // fresh name with no cache -> throws
  global.fetch = async () => {
    throw new Error('network down');
  };
  try {
    await assert.rejects(() => resolveProfile('NoCache_' + name), /network down/);
  } finally {
    global.fetch = realFetch;
  }
});

test('resolveProfile throws on a non-ok HTTP status', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({ status: 500, ok: false });
  try {
    await assert.rejects(() => resolveProfile('ServerError_Player'), /Mojang API HTTP 500/);
  } finally {
    global.fetch = realFetch;
  }
});
