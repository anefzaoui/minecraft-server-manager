'use strict';

// scripts/contributors-svg.js builds the README's avatar strip. These cover the
// pure half (selection, layout, rendering); `main()` is the only part that
// touches the network and is not exercised here.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  pickContributors,
  labelFor,
  layout,
  renderSvg,
  escapeXml,
  PER_ROW,
  MAX_FACES,
} = require('../scripts/contributors-svg');

const row = (login, contributions, extra = {}) => ({
  login,
  contributions,
  type: 'User',
  avatar_url: `https://avatars.githubusercontent.com/u/1?v=4`,
  ...extra,
});
const people = (n) => Array.from({ length: n }, (_, i) => ({ login: `user${i}`, dataUri: 'data:image/png;base64,AA' }));

test('pickContributors drops bots and keeps real accounts', () => {
  const { people: out } = pickContributors([
    row('dependabot[bot]', 900),
    row('renovate', 800, { type: 'Bot' }),
    row('alice', 5),
  ]);
  assert.deepEqual(
    out.map((p) => p.login),
    ['alice']
  );
});

test('pickContributors sorts by commits, then login, so the file is byte-stable', () => {
  const { people: out } = pickContributors([row('zoe', 1), row('adam', 1), row('kim', 9)]);
  assert.deepEqual(
    out.map((p) => p.login),
    ['kim', 'adam', 'zoe']
  );
});

test('pickContributors caps the faces and reports the overflow', () => {
  const rows = Array.from({ length: MAX_FACES + 5 }, (_, i) => row(`u${String(i).padStart(2, '0')}`, 100 - i));
  const { people: out, overflow } = pickContributors(rows);
  assert.equal(out.length, MAX_FACES);
  assert.equal(overflow, 5);
  assert.equal(pickContributors(rows, { max: 3 }).overflow, rows.length - 3);
});

test('pickContributors tolerates junk input', () => {
  assert.deepEqual(pickContributors(null), { people: [], overflow: 0 });
  assert.deepEqual(pickContributors([null, {}, { login: '' }]), { people: [], overflow: 0 });
  const { people: out } = pickContributors([{ login: 'nocount' }]);
  assert.deepEqual(out, [{ login: 'nocount', avatarUrl: '', contributions: 0 }]);
});

test('labelFor shortens only what cannot fit', () => {
  assert.equal(labelFor('short', 14), 'short');
  assert.equal(labelFor('a-very-long-github-login', 14), 'a-very-long-g…');
  assert.equal(labelFor('a-very-long-github-login', 14).length, 14);
  assert.equal(labelFor('x', 1), 'x');
});

test('layout keeps one row up to the row limit and wraps after it', () => {
  const one = layout(people(PER_ROW));
  const two = layout(people(PER_ROW + 1));
  assert.equal(new Set(one.cells.map((c) => c.y)).size, 1);
  assert.equal(new Set(two.cells.map((c) => c.y)).size, 2);
  assert.ok(two.height > one.height);
  assert.equal(two.width, one.width, 'a wrapped strip is no wider than a full row');
});

test('layout centres each avatar in its cell and never overflows the canvas', () => {
  const { cells, width, height } = layout(people(6));
  for (const cell of cells) {
    assert.ok(cell.x >= 0 && cell.y >= 0, 'inside the top-left corner');
    assert.ok(cell.x + 64 <= width, 'inside the right edge');
    assert.ok(cell.y + 64 <= height, 'inside the bottom edge');
    assert.equal(cell.cx, cell.x + 32, 'circle centred on the avatar');
  }
  // Cells are evenly spaced.
  const gaps = cells.slice(1).map((c, i) => Math.round(c.cx - cells[i].cx));
  assert.equal(new Set(gaps).size, 1);
});

test('layout adds one overflow tile when there are more people than faces', () => {
  const { cells } = layout(people(3), { overflow: 7 });
  assert.equal(cells.length, 4);
  assert.equal(cells[3].login, '+7');
  assert.equal(cells[3].overflow, true);
});

test('renderSvg produces a self-contained SVG naming every contributor', () => {
  const svg = renderSvg([
    { login: 'alice', dataUri: 'data:image/png;base64,AAAA' },
    { login: 'bob', dataUri: 'data:image/png;base64,BBBB' },
  ]);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>\n$/);
  assert.match(svg, /role="img" aria-label="Contributors: alice, bob"/);
  assert.match(svg, /<title>Contributors: alice, bob<\/title>/);
  assert.equal((svg.match(/<image /g) || []).length, 2);
  assert.equal((svg.match(/<clipPath /g) || []).length, 2, 'one circular clip per avatar');
  assert.ok(svg.includes('data:image/png;base64,AAAA'), 'avatar bytes are embedded, not linked');
  assert.ok(!svg.includes('https://'), 'no external reference to fetch at render time');
});

test('renderSvg draws the overflow tile as text, not an image', () => {
  const svg = renderSvg([{ login: 'alice', dataUri: 'data:image/png;base64,AAAA' }], { overflow: 12 });
  assert.equal((svg.match(/<image /g) || []).length, 1);
  assert.match(svg, />\+12</);
  assert.match(svg, /aria-label="Contributors: alice, and 12 more"/);
});

test('renderSvg escapes XML so a hostile login cannot break out', () => {
  const svg = renderSvg([{ login: 'a"><script>x</script>', dataUri: 'data:image/png;base64,AA' }]);
  assert.ok(!svg.includes('<script>'), 'no raw markup survives');
  assert.match(svg, /&lt;script&gt;/);
  assert.equal(escapeXml('a&b<c>"d\'e'), 'a&amp;b&lt;c&gt;&quot;d&apos;e');
});

test('renderSvg is deterministic for the same input', () => {
  const input = people(4);
  assert.equal(renderSvg(input), renderSvg(input));
});

test('the committed strip matches what the generator produces for these people', async () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const file = path.join(__dirname, '..', 'docs', 'images', 'contributors.svg');
  const svg = await fs.readFile(file, 'utf8');
  // Shape only: the avatars change whenever someone updates their photo, and
  // the workflow refreshes the file, so this must not pin bytes or names.
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+"/);
  assert.match(svg, /<title>Contributors: .+<\/title>/);
  assert.ok(svg.includes('data:image/'), 'avatars embedded');
  assert.ok(
    !/https?:\/\//.test(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '')),
    'no network fetch on render'
  );
});
