'use strict';

// Runs automatically after `pnpm install` so a fresh clone is styled without the
// user having to remember `pnpm run build`. The Tailwind CSS bundle
// (public/css/app.css) is a build artifact, not committed - missing it renders
// every page unstyled, which is a classic "works on my machine" trap.
//
// This degrades gracefully: if build tooling isn't present (e.g. a production
// `pnpm install --prod`), it warns and exits 0 rather than hard-failing the
// install. The documented `pnpm install` (with dev deps) always produces the CSS.

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Some environments set this to skip lifecycle build steps.
if (process.env.MSM_SKIP_POSTINSTALL === '1') {
  process.exit(0);
}

// Invoke the Tailwind CLI binary directly rather than round-tripping through a
// package manager - this works the same regardless of which one triggered the
// install, and pnpm always shims .bin for direct devDependencies like
// @tailwindcss/cli.
const bin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tailwindcss.CMD' : 'tailwindcss'
);

if (!fs.existsSync(bin)) {
  console.warn(
    '[postinstall] Tailwind CLI not found (production/prod-only install?). ' +
      'Run `pnpm run build` before `pnpm start`, or the UI will render unstyled.'
  );
  process.exit(0);
}

const res = spawnSync(bin, ['-i', 'assets/css/input.css', '-o', 'public/css/app.css', '--minify'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (res.status !== 0) {
  console.warn(
    '[postinstall] Could not build the CSS bundle automatically. ' +
      'Run `pnpm run build` before `pnpm start`, or the UI will render unstyled.'
  );
}

// Never fail the install over the CSS build.
process.exit(0);
