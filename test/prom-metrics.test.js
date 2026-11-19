'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMetrics, escapeLabel } = require('../src/utils/promMetrics');

test('renders HELP, TYPE, and labelled samples', () => {
  const out = renderMetrics([
    { name: 'msm_up', help: 'Up.', samples: [{ labels: { server_id: 'srv_a' }, value: 1 }] },
    { name: 'msm_total', help: 'Total.', samples: [{ value: 3 }] },
  ]);
  assert.equal(
    out,
    '# HELP msm_up Up.\n# TYPE msm_up gauge\nmsm_up{server_id="srv_a"} 1\n' +
      '# HELP msm_total Total.\n# TYPE msm_total gauge\nmsm_total 3\n'
  );
});

test('unknown readings are dropped and an empty family is omitted', () => {
  const out = renderMetrics([
    {
      name: 'msm_cpu',
      help: 'CPU.',
      samples: [
        { labels: { n: 'a' }, value: null },
        { labels: { n: 'b' }, value: undefined },
        { labels: { n: 'c' }, value: NaN },
        { labels: { n: 'd' }, value: 0 },
      ],
    },
    { name: 'msm_none', help: 'None.', samples: [{ value: null }] },
  ]);
  assert.match(out, /msm_cpu\{n="d"\} 0/);
  assert.doesNotMatch(out, /n="[abc]"/);
  assert.doesNotMatch(out, /msm_none/);
});

test('label values are escaped so a server name cannot break the format', () => {
  assert.equal(escapeLabel('a"b\\c\nd'), 'a\\"b\\\\c\\nd');
  const out = renderMetrics([{ name: 'm', help: 'h', samples: [{ labels: { name: 'My "Best"\nServer' }, value: 1 }] }]);
  assert.equal(out.split('\n').filter((l) => l.startsWith('m{')).length, 1);
  assert.match(out, /name="My \\"Best\\"\\nServer"/);
});

test('no samples at all renders an empty body', () => {
  assert.equal(renderMetrics([]), '');
});
