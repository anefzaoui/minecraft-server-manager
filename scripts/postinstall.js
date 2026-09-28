'use strict';

// Runs automatically after `pnpm install` so a fresh clone - or a `git pull`
// followed by `pnpm install` on a deployment - is fully built without the user
// having to remember `pnpm run build`. Both bundles are gitignored build
// artifacts: missing CSS renders every page unstyled, and a stale JS bundle
// serves old page logic against new templates, which fails silently.
//
// This degrades gracefully: if build tooling isn't present (e.g. a production
// `pnpm install --prod`), it warns and exits 0 rather than hard-failing the
// install. The documented `pnpm install` (with dev deps) always produces both.

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

// Same story for the client-JS bundle (public/dist/js): without it, `pnpm
// start` serves either no JS or a stale bundle against new templates.
const root = path.join(__dirname, '..');
try {
  require.resolve('esbuild', { paths: [root] });
  const buildJs = spawnSync(process.execPath, [path.join(__dirname, 'build-js.js')], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (buildJs.status !== 0) {
    console.warn('[postinstall] Could not build the client-JS bundle automatically. Run `pnpm run build`.');
  }
} catch {
  console.warn(
    '[postinstall] esbuild not found (production/prod-only install?). ' +
      'Run `pnpm run build` before `pnpm start`, or page scripts may be stale.'
  );
}

// Never fail the install over the builds.
process.exit(0);
