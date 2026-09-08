'use strict';

require('./helpers/app'); // runs migrate()
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { resolveSkin, getSkinImage } = require('../src/services/skins');

test.before(() => {
  db.run("DELETE FROM api_cache WHERE key LIKE 'mojang-skin:%'");
});
test.after(() => {
  db.run("DELETE FROM api_cache WHERE key LIKE 'mojang-skin:%'");
});

const UUID = '069a79f4-44e9-4726-a5be-fca90e38aaf5';
const SKIN_URL = 'http://textures.minecraft.net/texture/abc123';

function profileProps({ model } = {}) {
  const textures = { textures: { SKIN: { url: SKIN_URL } } };
  if (model) textures.textures.SKIN.metadata = { model };
  return {
    status: 200,
    ok: true,
    json: async () => ({
      id: UUID.replace(/-/g, ''),
      name: 'Notch',
      properties: [{ name: 'textures', value: Buffer.from(JSON.stringify(textures)).toString('base64') }],
    }),
  };
}

test('resolveSkin parses the texture and caches it', async () => {
  let called = 0;
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    called++;
    assert.equal(url, `https://sessionserver.mojang.com/session/minecraft/profile/${UUID.replace(/-/g, '')}`);
    return profileProps();
  };
  try {
    const skin = await resolveSkin(UUID);
    assert.deepEqual(skin, { url: SKIN_URL, model: 'wide' });
    assert.equal(called, 1);

    // cached second call (undashed key) - no network
    const again = await resolveSkin(UUID.replace(/-/g, ''));
    assert.deepEqual(again, { url: SKIN_URL, model: 'wide' });
    assert.equal(called, 1);
  } finally {
    global.fetch = realFetch;
  }
});

test('resolveSkin surfaces a slim model', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => profileProps({ model: 'slim' });
  try {
    assert.equal((await resolveSkin('aaaa-bbbb')).model, 'slim');
  } finally {
    global.fetch = realFetch;
  }
});

test('resolveSkin returns null for an unknown uuid', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({ status: 204, ok: false });
  try {
    assert.equal(await resolveSkin('00000000-0000-0000-0000-000000000000'), null);
  } finally {
    global.fetch = realFetch;
  }
});

test('resolveSkin throws on network failure with nothing cached, serves stale when cached', async () => {
  const uuid = '11111111-2222-3333-4444-555555555555';
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now', '-2 days'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'mojang-skin:' + uuid.replace(/-/g, ''),
    JSON.stringify({ url: 'http://textures.minecraft.net/texture/stale', model: 'wide' })
  );
  const realFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };
  try {
    const skin = await resolveSkin(uuid);
    assert.equal(skin.url, 'http://textures.minecraft.net/texture/stale');
  } finally {
    global.fetch = realFetch;
  }
});

test('getSkinImage fetches and in-memory caches pixel bytes', async () => {
  const realFetch = global.fetch;
  const png = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
  let calls = 0;
  global.fetch = async (url) => {
    calls++;
    assert.equal(url, SKIN_URL);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
    };
  };
  try {
    const first = await getSkinImage(SKIN_URL);
    assert.deepEqual(first, png);
    const second = await getSkinImage(SKIN_URL);
    assert.deepEqual(second, png);
    assert.equal(calls, 1); // second call served from memory
  } finally {
    global.fetch = realFetch;
  }
});
