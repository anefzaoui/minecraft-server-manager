#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copies Vitrine (and, if asked, Vitrine modal) into a site's folder, pinned to a commit, and checks
// such a copy later. Node 18+, no dependencies.
//
//   node vendor.mjs fetch <folder> [--lightbox=<ref>] [--modal=<ref>]
//       Downloads the files of each library asked for (a commit SHA or a tag; at least one) from
//       GitHub, and writes <folder>/vitrine.lock.json: each repository, its ref, its version and the
//       SHA-256 of every file. vitrine-core.js is shared: both repositories must carry the same bytes.
//   node vendor.mjs check <folder>
//       Fails (exit 1) when a file is missing, differs from the lock, or its first line doesn't name
//       the version the lock pins. Run it in your site's tests or build.
//
// A vendored copy is never edited in place: change Vitrine upstream, then fetch the new version.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const LIBS = {
  "anefzaoui/vitrine": ["vitrine-core.js", "vitrine.js", "vitrine.css"],
  "anefzaoui/vitrine-modal": ["vitrine-core.js", "vitrine-modal.js", "vitrine-modal.css"],
};
const HEADER = /^\/\*! Vitrine(?: core| modal)? v(\d+\.\d+\.\d+) · https:\/\/github\.com\/anefzaoui\/(vitrine|vitrine-modal) · GPL-3\.0-or-later\./;

export const sha256 = (text) => crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
export const versionOf = (text) => (text.split(/\r?\n/, 1)[0].match(HEADER) || [])[1] || null;

export function check(dir) {
  const bad = [];
  let lock;
  try { lock = JSON.parse(fs.readFileSync(path.join(dir, "vitrine.lock.json"), "utf8")); } catch { return [`no readable vitrine.lock.json in ${dir}`]; }
  for (const [repo, entry] of Object.entries(lock)) {
    for (const [name, sum] of Object.entries(entry.files || {})) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) { bad.push(`${name} (${repo}) is missing`); continue; }
      const text = fs.readFileSync(file, "utf8");
      if (sha256(text) !== sum) bad.push(`${name} differs from ${repo} ${entry.version} (${entry.ref}): fetch it again, don't edit it`);
      const v = versionOf(text);
      if (name !== "vitrine-core.js" && v !== entry.version) bad.push(`${name}: its first line names ${v || "no version"}, the lock ${entry.version}`);
    }
  }
  return bad;
}

async function fetchLib(repo, ref, dir) {
  const files = {};
  let version = null;
  for (const name of LIBS[repo]) {
    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${name}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const text = await res.text();
    if (!versionOf(text)) throw new Error(`${url}: not a Vitrine file`);
    if (name !== "vitrine-core.js") version = versionOf(text);
    const out = path.join(dir, name);
    if (fs.existsSync(out) && name === "vitrine-core.js" && sha256(fs.readFileSync(out, "utf8")) !== sha256(text)) {
      throw new Error("vitrine-core.js differs between the two refs: pick versions that share their core");
    }
    fs.writeFileSync(out, text);
    files[name] = sha256(text);
  }
  return { ref, version, files };
}

async function main() {
  const [cmd, dir, ...rest] = process.argv.slice(2);
  const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
  if (cmd === "check" && dir) {
    const bad = check(path.resolve(dir));
    if (bad.length) { console.error("Vitrine copy check failed:\n  " + bad.join("\n  ")); process.exit(1); }
    console.log(`Vitrine: ${Object.entries(JSON.parse(fs.readFileSync(path.join(dir, "vitrine.lock.json"), "utf8"))).map(([r, e]) => `${r} ${e.version}`).join(", ")}: unchanged`);
  } else if (cmd === "fetch" && dir && (opts.lightbox || opts.modal)) {
    const out = path.resolve(dir);
    fs.mkdirSync(out, { recursive: true });
    const lock = {};
    if (opts.lightbox) lock["anefzaoui/vitrine"] = await fetchLib("anefzaoui/vitrine", opts.lightbox, out);
    if (opts.modal) lock["anefzaoui/vitrine-modal"] = await fetchLib("anefzaoui/vitrine-modal", opts.modal, out);
    fs.writeFileSync(path.join(out, "vitrine.lock.json"), JSON.stringify(lock, null, 2) + "\n");
    console.log(`Vitrine -> ${out}: ` + Object.entries(lock).map(([r, e]) => `${r} ${e.version} (${e.ref})`).join(", "));
  } else {
    console.error(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).slice(1, 13).map((l) => l.slice(3)).join("\n"));
    process.exit(2);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e.message); process.exit(1); });
