'use strict';

// Apply pending DB migrations without booting the whole panel. Normally
// migrations just run as a side effect of `npm start` - this is for ops
// scripts, container init, or inspecting/preparing a data dir standalone.
//
// Usage:
//   node scripts/migrate.js

const { migrate } = require('../src/db/migrate');

const count = migrate();
console.log(count ? `Applied ${count} migration(s).` : 'Already up to date - nothing to apply.');
