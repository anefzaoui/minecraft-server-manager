'use strict';

// Bundle + minify the client JS. Every page currently pulls /js/app.js (which
// statically imports ~13 lib/* modules) plus its own /js/pages/<name>.js source
// file - dozens of unminified round-trips per load. esbuild collapses each entry
// into one minified bundle, sharing common code through split chunks, written to
// public/dist/js/. app.js is served from there when the bundle exists (see
// src/web/app.js); the raw source stays the dev/no-build fallback.

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'public', 'js');
const pagesDir = path.join(srcDir, 'pages');
const outDir = path.join(root, 'public', 'dist', 'js');

const entryPoints = [
  path.join(srcDir, 'app.js'),
  ...fs
    .readdirSync(pagesDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(pagesDir, f)),
];

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  const result = await esbuild.build({
    entryPoints,
    outbase: srcDir,
    outdir: outDir,
    bundle: true,
    minify: true,
    format: 'esm',
    splitting: true,
    target: ['es2022'],
    sourcemap: false,
    metafile: true,
    logLevel: 'warning',
  });

  let total = 0;
  for (const [file, meta] of Object.entries(result.metafile.outputs)) {
    if (file.endsWith('.map')) continue;
    total += meta.bytes;
  }
  const files = Object.keys(result.metafile.outputs).filter((f) => !f.endsWith('.map')).length;
  console.log(`[build:js] ${files} files, ${(total / 1024).toFixed(0)} KB minified -> public/dist/js/`);
}

main().catch((err) => {
  console.error('[build:js] failed:', err.message);
  process.exit(1);
});
