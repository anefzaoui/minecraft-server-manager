'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeSvg } = require('../src/utils/svgSanitize');

test('scripting, event handlers, foreignObject and hrefs are stripped', () => {
  const out = sanitizeSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script>' +
      '<foreignObject><body>x</body></foreignObject>' +
      '<a href="javascript:alert(1)"><rect width="1" height="1"/></a>' +
      '<use xlink:href="https://evil.example/x.svg#a"/><image href="data:image/png;base64,AAAA"/></svg>'
  );
  assert.doesNotMatch(out, /script|onload|foreignObject|href|javascript|image/i);
  assert.match(out, /<rect/);
});

test('case-sensitive SVG elements and attributes survive intact', () => {
  const src =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" preserveAspectRatio="xMidYMid">' +
    '<defs><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f00"/></linearGradient>' +
    '<clipPath id="c"><rect width="5" height="5"/></clipPath>' +
    '<filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs>' +
    '<circle cx="5" cy="5" r="4" fill="url(#g)" clip-path="url(#c)" filter="url(#b)"/></svg>';
  const out = sanitizeSvg(src);
  for (const needle of [
    'viewBox=',
    'preserveAspectRatio=',
    '<linearGradient',
    'gradientUnits=',
    '<clipPath',
    '<feGaussianBlur',
    'stdDeviation=',
  ]) {
    assert.ok(out.includes(needle), `${needle} kept`);
  }
  assert.match(out, /fill="url\(#g\)"/, 'same-document paint server refs are kept');
});

test('external url() references in presentation attributes and inline style are dropped', () => {
  const out = sanitizeSvg(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1" height="1" fill="url(https://evil.example/p.svg#x)" stroke="url(#ok)" ' +
      'style="fill:url(http://evil.example/a);stroke-width:2;mask:url(&quot;//evil.example/m&quot;)"/></svg>'
  );
  assert.doesNotMatch(out, /evil\.example/);
  assert.match(out, /stroke="url\(#ok\)"/);
  assert.match(out, /stroke-width:2/);
});
