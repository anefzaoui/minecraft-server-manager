'use strict';

// The `or` / `and` template helpers take any number of values (like JS `||` /
// `&&`). The two-argument versions ignored a third value onward, so the server
// header's (or running starting unhealthy stalled) check showed Start for an
// unhealthy or stalled server instead of Restart/Stop.

const app = require('./helpers/app');
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('express-handlebars');
const db = require('../src/db');
const containers = require('../src/docker/containers');
const { orHelper, andHelper } = require('../src/web/app');

// An isolated Handlebars with just these helpers registered.
const hbs = create().handlebars.create();
hbs.registerHelper({ or: orHelper, and: andHelper, eq: (a, b) => a === b });
const render = (tpl, ctx = {}) => hbs.compile(tpl)(ctx);

test('or and and look at every argument, not just the first two', () => {
  assert.equal(
    render("{{#if (or (eq s 'a') (eq s 'b') (eq s 'c') (eq s 'd'))}}yes{{else}}no{{/if}}", { s: 'd' }),
    'yes'
  );
  assert.equal(render("{{#if (or (eq s 'a') (eq s 'b') (eq s 'c'))}}yes{{else}}no{{/if}}", { s: 'x' }), 'no');
  assert.equal(render('{{#if (and a b c)}}yes{{else}}no{{/if}}', { a: 1, b: 1, c: 0 }), 'no');
  assert.equal(render('{{#if (and a b c)}}yes{{else}}no{{/if}}', { a: 1, b: 1, c: 1 }), 'yes');
});

test('they return values like || and &&, so two-argument uses render as before', () => {
  assert.equal(render('{{or a b}}', { a: '', b: 'fallback' }), 'fallback');
  assert.equal(render('{{or a b c}}', { a: 0, b: 'second', c: 'third' }), 'second');
  assert.equal(render('{{or a b}}', { a: 0, b: '' }), ''); // all falsy: the last one
  assert.equal(render('{{and a b}}', { a: 'x', b: 'y' }), 'y');
  assert.equal(render('{{and a b c}}', { a: 'x', b: 0, c: 'z' }), '0');
});

// ---- the server header, rendered ------------------------------------------------

let cookie;
let status = 'stopped';
test.before(async () => {
  // The page asks Docker for the live status; answer from this test instead.
  containers.inspectStatus = async () => ({ exists: true, status });
  await app.start();
  cookie = await app.adminCookie();
  app.seedServer('srv_hdr');
});
test.after(app.stop);

async function header(s) {
  status = s;
  db.run("UPDATE servers SET status = ? WHERE id = 'srv_hdr'", s);
  const r = await app.req('GET', '/servers/srv_hdr', { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200, `page for ${s}`);
  const has = (action) => r.text.includes(`data-server-action="${action}"`);
  return { start: has('start'), restart: has('restart'), stop: has('stop') };
}

for (const s of ['running', 'starting', 'unhealthy', 'stalled']) {
  test(`a ${s} server's header offers Restart and Stop, not Start`, async () => {
    assert.deepEqual(await header(s), { start: false, restart: true, stop: true });
  });
}

for (const s of ['stopped', 'crashed']) {
  test(`a ${s} server's header offers Start`, async () => {
    assert.deepEqual(await header(s), { start: true, restart: false, stop: false });
  });
}
