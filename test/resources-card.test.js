'use strict';

// The Resources card on Settings → Configuration: the starting heap
// (INIT_MEMORY) and strict quota mode can be set from the panel, and a
// starting heap larger than the heap is refused before Java would refuse it.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');

let cookie;
let id;
test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  id = app.seedServer('srv_rescard'); // heap 1024 MB
});
test.after(() => app.stop());

const row = () => require('../src/db').get('SELECT env_json, quota_strict, heap_mb FROM servers WHERE id = ?', id);

test('the card renders the initial heap and the strict quota toggle', async () => {
  let page = await app.req('GET', `/servers/${id}/settings`, { cookie });
  assert.equal(page.status, 200);
  assert.match(page.text, /id="st-initheap" value=""/);
  assert.match(page.text, /<input type="checkbox" id="st-quota-strict" >/);

  const db = require('../src/db');
  db.run('UPDATE servers SET env_json = \'{"INIT_MEMORY":"512M"}\', quota_strict = 1 WHERE id = ?', id);
  page = await app.req('GET', `/servers/${id}/settings`, { cookie });
  assert.match(page.text, /id="st-initheap" value="512"/);
  assert.match(page.text, /<input type="checkbox" id="st-quota-strict" checked>/);
  db.run("UPDATE servers SET env_json = '{}', quota_strict = 0 WHERE id = ?", id);
});

test('saving stores strict mode and the initial heap', async () => {
  const r = await app.req('PATCH', `/api/servers/${id}`, {
    cookie,
    body: { quotaStrict: true, env: { INIT_MEMORY: '512' } },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(row().quota_strict, 1);
  assert.equal(JSON.parse(row().env_json).INIT_MEMORY, '512');
});

test('a starting heap larger than the heap is refused', async () => {
  const r = await app.req('PATCH', `/api/servers/${id}`, { cookie, body: { env: { INIT_MEMORY: '2048' } } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /initial heap \(2048 MB\) can't be larger than the Java heap \(1024 MB\)/);
  assert.equal(JSON.parse(row().env_json).INIT_MEMORY, '512', 'the stored value is untouched');

  // Lowering the heap under the stored starting heap is refused the same way.
  const lower = await app.req('PATCH', `/api/servers/${id}`, {
    cookie,
    body: { env: { INIT_MEMORY: '1024' } },
  });
  assert.equal(lower.status, 200, lower.text);
  const heap = await app.req('PATCH', `/api/servers/${id}`, {
    cookie,
    body: { heapMb: 768, containerMemoryMb: 1536 },
  });
  assert.equal(heap.status, 400);
  assert.equal(row().heap_mb, 1024);
});

test("the create wizard's Advanced mode offers the initial heap, not the maximum heap", async () => {
  const page = await app.req('GET', '/servers/new', { cookie });
  assert.equal(page.status, 200);
  assert.match(page.text, /data-catalog-key="INIT_MEMORY"/);
  assert.doesNotMatch(page.text, /data-catalog-key="MAX_MEMORY"/);
});
