'use strict';

// A zod boolean that also accepts the string/number spellings a form post or a
// hand-written curl sends ("true"/"false"/"1"/"0"/1/0) - and REJECTS anything
// else. `z.coerce.boolean()` is the wrong tool for that: it runs `Boolean(x)`,
// so the string "false" becomes true and an admin toggling something off
// turns it on instead.

const { z } = require('zod');

const TRUE = new Set(['true', '1', 'yes', 'on']);
const FALSE = new Set(['false', '0', 'no', 'off', '']);

const boolish = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : v;
  if (typeof v === 'string') {
    const low = v.trim().toLowerCase();
    if (TRUE.has(low)) return true;
    if (FALSE.has(low)) return false;
  }
  return v; // anything else fails the inner boolean check
}, z.boolean());

module.exports = { boolish };
