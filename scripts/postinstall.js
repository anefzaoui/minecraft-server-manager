'use strict';

// Runs automatically after `npm install` so a fresh clone is styled without the
// user having to remember `npm run build`. The Tailwind CSS bundle
// (public/css/app.css) is a build artifact, not committed — missing it renders
// every page unstyled, which is a classic "works on my machine" trap.
//
// This degrades gracefully: if build tooling isn't present (e.g. a production
// `npm install --omit=dev`), it warns and exits 0 rather than hard-failing the
// install. The documented `npm install` (with dev deps) always produces the CSS.

const { spawnSync } = require('node:child_process');

// Some environments set this to skip lifecycle build steps.
if (process.env.MSM_SKIP_POSTINSTALL === '1') {
  process.exit(0);
}

const res = spawnSync('npm', ['run', 'build:css'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (res.status !== 0) {
  console.warn(
    '[postinstall] Could not build the CSS bundle automatically. ' +
      'Run `npm run build` before `npm start`, or the UI will render unstyled.'
  );
}

// Never fail the install over the CSS build.
process.exit(0);
