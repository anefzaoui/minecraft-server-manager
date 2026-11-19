'use strict';

// The shared bounded tree walker that replaced three per-service copies.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dirSize } = require('../src/utils/statSizes');

test('dirSize sums a deep, wide tree, skips symlinks, and reads a missing root as 0', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-dirsize-'));
  let expected = 0;
  // 6 levels deep, 3 subdirs and 2 files per level: enough fan-out that the
  // old per-directory pools would have multiplied their concurrency.
  const build = (dir, depth) => {
    for (let f = 0; f < 2; f++) {
      const bytes = depth * 10 + f + 1;
      fs.writeFileSync(path.join(dir, `f${f}.bin`), Buffer.alloc(bytes));
      expected += bytes;
    }
    if (depth === 0) return;
    for (let d = 0; d < 3; d++) {
      const sub = path.join(dir, `d${d}`);
      fs.mkdirSync(sub);
      build(sub, depth - 1);
    }
  };
  build(root, 5);
  fs.symlinkSync(root, path.join(root, 'loop'));
  fs.symlinkSync(path.join(root, 'f0.bin'), path.join(root, 'dupe.bin'));

  assert.equal(await dirSize(root), expected);
  assert.equal(await dirSize(path.join(root, 'nope')), 0);
  fs.rmSync(root, { recursive: true, force: true });
});
