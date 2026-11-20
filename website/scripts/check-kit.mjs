// Checks a copy of SiteKit (the lightbox and modals synced from anefzaoui/misterdownloadmanager
// website/kit/) against the kit.json it came with: every file present, its first line the header
// of that version, its content unchanged. Exit 1 otherwise. Node, no dependencies.
//
//   node check-kit.mjs <kit folder>
//
// The kit is changed in its master copy only, then synced (tools/website/kit.py sync there).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] || ".");
const FILES = ["core.js", "modal.js", "lightbox.js", "kit.css"];
const HEADER = /^\/\*! SiteKit (\d+\.\d+\.\d+) \| synced from anefzaoui\/misterdownloadmanager website\/kit\/ \| MIT License \*\/$/;
const bad = [];
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(dir, "kit.json"), "utf8"));
} catch {
  console.error(`SiteKit: no readable kit.json in ${dir}`);
  process.exit(1);
}
for (const name of FILES) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) { bad.push(`${name} is missing`); continue; }
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = text.split("\n")[0].match(HEADER);
  if (!m || m[1] !== manifest.version) bad.push(`${name}: its first line isn't the SiteKit ${manifest.version} header`);
  const sum = crypto.createHash("sha256").update(text).digest("hex");
  if (sum !== manifest.files[name]) bad.push(`${name} differs from SiteKit ${manifest.version}: change the master copy, then sync it here`);
}
if (bad.length) {
  console.error("SiteKit copy check failed:\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log(`SiteKit ${manifest.version}: ${FILES.length} files unchanged`);
