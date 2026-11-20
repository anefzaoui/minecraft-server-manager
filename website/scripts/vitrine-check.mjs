#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Checks a vendored copy of Vitrine against its vitrine.lock.json (written by tools/vendor.mjs fetch):
// every file present, unchanged (SHA-256) and naming, in its first line, the version the lock pins.
// Exit 1 otherwise. Node 18+, no dependencies, no network: copy this file into your site and run
//
//   node vitrine-check.mjs <folder>
//
// in its build or tests. A vendored copy is never edited in place: change Vitrine upstream, then
// fetch the new version.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HEADER = /^\/\*! Vitrine(?: core| modal)? v(\d+\.\d+\.\d+) · https:\/\/github\.com\/anefzaoui\/(vitrine|vitrine-modal) · GPL-3\.0-or-later\./;

export const sha256 = (text) => crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
export const versionOf = (text) => (text.split(/\r?\n/, 1)[0].match(HEADER) || [])[1] || null;

export function check(dir) {
  const bad = [];
  let lock;
  try { lock = JSON.parse(fs.readFileSync(path.join(dir, "vitrine.lock.json"), "utf8")); } catch { return [`no readable vitrine.lock.json in ${dir}`]; }
  for (const [repo, entry] of Object.entries(lock)) {
    for (const [name, sum] of Object.entries(entry.files || {})) {
      let text;
      try { text = fs.readFileSync(path.join(dir, name), "utf8"); } catch { bad.push(`${name} (${repo}) is missing`); continue; }
      if (sha256(text) !== sum) bad.push(`${name} differs from ${repo} ${entry.version} (${entry.ref}): fetch it again, don't edit it`);
      const v = versionOf(text);
      if (name !== "vitrine-core.js" && v !== entry.version) bad.push(`${name}: its first line names ${v || "no version"}, the lock ${entry.version}`);
    }
  }
  return bad;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dir = path.resolve(process.argv[2] || ".");
  const bad = check(dir);
  if (bad.length) { console.error("Vitrine copy check failed:\n  " + bad.join("\n  ")); process.exit(1); }
  const lock = JSON.parse(fs.readFileSync(path.join(dir, "vitrine.lock.json"), "utf8"));
  console.log(`Vitrine: ${Object.entries(lock).map(([r, e]) => `${r} ${e.version}`).join(", ")}: unchanged`);
}
