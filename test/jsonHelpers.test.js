'use strict';

// The two JSON-embedding template helpers. Issue #37: one helper named `json`
// was right or broken depending on the brace count around it, and a script
// island rendered with {{json}} produced `&quot;`, killing the settings page
// script at load. Now each helper returns a SafeString that is already correct
// for its destination, so {{helper x}} and {{{helper x}}} are the same thing:
//   jsonScript -> <script> text (the browser does not decode entities there)
//   jsonAttr   -> quoted data-* attribute (the browser decodes entities there)
// test/template-json.test.js checks the templates use each where it belongs.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('express-handlebars');
const { jsonScript, jsonAttr } = require('../src/web/app');

const helpers = { jsonScript, jsonAttr };
const hb = create().handlebars;
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
  return hb.compile(src)(ctx, { helpers });
}

test('jsonScript: valid JSON, exact round-trip, nothing that could close a <script> tag', () => {
  const out = String(jsonScript(NASTY));
  assert.doesNotMatch(out, new RegExp('[<>&' + LS + PS + ']'));
  assert.ok(!out.includes('</script'));
  assert.deepEqual(JSON.parse(out), NASTY);
  assert.equal(String(jsonScript(null)), 'null');
  assert.equal(String(jsonScript(undefined)), 'null');
  assert.equal(String(jsonScript('usr_x')), '"usr_x"');
});

test('jsonScript renders the same with {{ }} and {{{ }}}, and both parse (issue #37)', () => {
  for (const v of [NASTY, 'usr_x', [], null]) {
    const two = render('{{jsonScript v}}', { v });
    const three = render('{{{jsonScript v}}}', { v });
    assert.equal(two, three);
    assert.deepEqual(JSON.parse(two), v);
  }
  const html = render('<script type="application/json" id="x">{{jsonScript v}}</script>', { v: NASTY });
  assert.deepEqual(JSON.parse(html.match(/id="x">(.*)<\/script>$/s)[1]), NASTY);
});

test('jsonAttr: entity-escaped, survives a quoted attribute, decodes back to the same JSON', () => {
  const out = String(jsonAttr(NASTY));
  assert.doesNotMatch(out, /["'<>`]/);
  assert.deepEqual(JSON.parse(decodeEntities(out)), NASTY);
  for (const v of [NASTY, 'usr_x', [], null]) {
    const two = render('<div data-x="{{jsonAttr v}}"></div>', { v });
    const three = render('<div data-x="{{{jsonAttr v}}}"></div>', { v });
    assert.equal(two, three);
    const m = two.match(/^<div data-x="([^"]*)"><\/div>$/);
    assert.ok(m, 'a raw quote leaked into the attribute');
    assert.deepEqual(JSON.parse(decodeEntities(m[1])), v);
  }
});

test('the helpers are not interchangeable: each is wrong in the other context', () => {
  // jsonAttr inside <script> text is the #37 bug (entities are not decoded there).
  assert.throws(() => JSON.parse(render('{{jsonAttr v}}', { v: 'usr_x' })));
  // jsonScript inside a double-quoted attribute ends the attribute at the first quote.
  const html = render('<div data-x="{{jsonScript v}}"></div>', { v: 'usr_x' });
  assert.equal(html, '<div data-x=""usr_x""></div>');
});

test('the old ambiguous json helper is gone, so a leftover call fails loudly', () => {
  assert.throws(() => hb.compile('{{json v}}')({ v: 1 }, { helpers }), /Missing helper: "json"/);
});
