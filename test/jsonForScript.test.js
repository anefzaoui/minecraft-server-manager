'use strict';

// The `json` template helper feeds JSON.parse on the client from two places
// with opposite escaping rules: <script> text (the browser does NOT decode HTML
// entities there, so the template must emit it raw with {{{json x}}}) and
// data-* attributes (entities ARE decoded, so {{json x}} is right and a raw
// quote would end the attribute). Issue #37: a script island rendered with
// {{json}} produced `&quot;` and the whole settings page script died at load.
// This pins the helper's half of the contract; test/template-json.test.js
// pins the templates' half.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('express-handlebars');
const { jsonForScript } = require('../src/web/app');

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const NASTY = {
  id: 'usr_x',
  name: "Te\"st <&> 'x' </script> =`",
  sep: 'a' + LS + 'b' + PS + 'c',
  nested: [{ k: '"q"' }, null, 1.5, true],
  unicode: 'héllo 日本',
};

// What a browser does to an attribute value before dataset.* sees it.
function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x3D;/g, '=')
    .replace(/&#x60;/g, '`')
    .replace(/&amp;/g, '&');
}

function render(src, ctx) {
  return create().handlebars.compile(src)(ctx, { helpers: { json: jsonForScript } });
}

test('never emits the characters that could close a <script> tag', () => {
  const out = jsonForScript(NASTY);
  assert.doesNotMatch(out, new RegExp('[<>&' + LS + PS + ']'));
  assert.ok(!out.includes('</script'));
});

test('is valid JSON that round-trips the value exactly', () => {
  assert.deepEqual(JSON.parse(jsonForScript(NASTY)), NASTY);
  assert.equal(jsonForScript(null), 'null');
  assert.equal(jsonForScript(undefined), 'null');
  assert.equal(jsonForScript('usr_x'), '"usr_x"');
});

test('{{{json}}} in a <script> island parses as-is (issue #37)', () => {
  const html = render('<script type="application/json" id="x">{{{json v}}}</script>', { v: NASTY });
  const body = html.match(/id="x">(.*)<\/script>$/s)[1];
  assert.deepEqual(JSON.parse(body), NASTY);
  assert.deepEqual(JSON.parse(render('{{{json v}}}', { v: 'usr_x' })), 'usr_x');
});

test('{{json}} in a <script> island is the #37 bug: entities are not decoded there', () => {
  const body = render('{{json v}}', { v: 'usr_x' });
  assert.equal(body, '&quot;usr_x&quot;');
  assert.throws(() => JSON.parse(body));
});

test('{{json}} in a data-* attribute survives the attribute and decodes back to JSON', () => {
  const html = render('<div data-x="{{json v}}"></div>', { v: NASTY });
  // The attribute is still one attribute: exactly two double quotes around it.
  const m = html.match(/^<div data-x="([^"]*)"><\/div>$/);
  assert.ok(m, 'a raw quote leaked into the attribute');
  assert.deepEqual(JSON.parse(decodeEntities(m[1])), NASTY);
});
