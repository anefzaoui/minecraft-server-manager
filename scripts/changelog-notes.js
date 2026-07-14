'use strict';

// Print the CHANGELOG.md section for a given version, for use as GitHub Release
// notes. Usage: node scripts/changelog-notes.js 0.6.1

const fs = require('node:fs');
const path = require('node:path');

const version = (process.argv[2] || '').trim();
if (!version) {
  process.stderr.write('Usage: node scripts/changelog-notes.js <version>\n');
  process.exit(1);
}

const md = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const out = [];
let capturing = false;
for (const line of md.split(/\r?\n/)) {
  if (/^## \[/.test(line)) {
    if (capturing) break; // reached the next version's heading
    if (line.startsWith(`## [${version}]`)) {
      capturing = true;
      continue;
    }
  }
  if (capturing) out.push(line);
}

process.stdout.write((out.join('\n').trim() || `Release ${version}`) + '\n');
