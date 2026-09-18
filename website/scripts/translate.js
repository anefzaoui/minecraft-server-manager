// Translates the site's English source (marketing copy, docs sidebar labels, and
// the synced English docs) into every locale in src/i18n/locales.js, writing the
// results next to the source so they are committed and the build stays offline.
//
//   pnpm run translate --dry-run            # what would be sent, and the cost estimate
//   pnpm run translate                      # Batch API (50% off), polls until done
//   pnpm run translate --sync               # direct calls, for a handful of units
//   pnpm run translate --locales=ar,fr      # subset of locales
//   pnpm run translate --only=marketing     # marketing | sidebar | docs
//   pnpm run translate --resume=<batch id>  # pick up a submitted batch
//
// Incremental by construction: src/i18n/translation-manifest.json records the
// sha256 of the English text each translation was made from, and a unit is only
// re-sent when its source hash changed. Deterministic checks (same JSON shape,
// same code fences, same link targets) guard every result before it is written.
//
// Auth: the SDK reads ANTHROPIC_API_KEY, or the profile from `ant auth login`.
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, DEFAULT_LOCALE, getLocale, langTag } from '../src/i18n/locales.js';
import { SIDEBAR_LABELS } from '../src/i18n/sidebar.js';
import { sync as syncDocs } from './sync-docs.js';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const i18nDir = join(site, 'src', 'i18n');
const docsEnDir = join(site, 'src', 'content', 'docs', 'docs');
const manifestPath = join(i18nDir, 'translation-manifest.json');
const batchStatePath = join(site, '.translation-batch.json');

const MODEL = 'claude-opus-5';
const MAX_TOKENS = 16000;
// Batch API prices for the model above, USD per million tokens (50% of standard).
const PRICE_IN = 2.5;
const PRICE_OUT = 12.5;

const args = new Map(process.argv.slice(2).map((a) => (a.includes('=') ? a.split(/=(.*)/s).slice(0, 2) : [a, true])));
const dryRun = args.has('--dry-run');
const syncMode = args.has('--sync');
const only = args.get('--only') || 'all';
const resume = typeof args.get('--resume') === 'string' ? args.get('--resume') : null;
const wantedLocales = typeof args.get('--locales') === 'string' ? args.get('--locales').split(',') : null;

const targets = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).filter(
  (l) => !wantedLocales || wantedLocales.includes(l.code)
);

const sha = (s) => createHash('sha256').update(s).digest('hex');
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const writeJson = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

// ---------- units ----------

function collectUnits() {
  const units = [];
  if (only === 'all' || only === 'marketing') {
    const en = readJson(join(i18nDir, 'en.json'));
    for (const [key, value] of Object.entries(en)) {
      if (key === '$comment') continue;
      units.push({ id: `marketing:${key}`, kind: 'json', source: JSON.stringify(value, null, 2), key });
    }
  }
  if (only === 'all' || only === 'sidebar') {
    units.push({ id: 'sidebar', kind: 'json', source: JSON.stringify(SIDEBAR_LABELS, null, 2) });
  }
  if (only === 'all' || only === 'docs') {
    syncDocs();
    for (const file of readdirSync(docsEnDir)
      .filter((f) => f.endsWith('.md'))
      .sort()) {
      units.push({
        id: `docs:${file.slice(0, -3)}`,
        kind: 'markdown',
        source: readFileSync(join(docsEnDir, file), 'utf8'),
        slug: file.slice(0, -3),
      });
    }
  }
  return units;
}

const SYSTEM = `You translate the website of Minecraft Server Manager, a free self-hosted control panel for Minecraft servers that run in Docker containers. Translate into the requested language for a technical but general audience: natural, idiomatic, concise, no machine-translation stiffness.

Rules:
- Keep product and proper names untranslated: Minecraft, Mojang, Docker, Java, RCON, Modrinth, CurseForge, Hangar, SpigotMC, GitHub, Discord, BlueMap, Fabric, Forge, NeoForge, Quilt, Paper, Purpur, Bedrock, Geyser, Floodgate, Node.js, pnpm, itzg, mclo.gs, Minecraft Server Manager (you may transliterate the product name only if that is standard in the target language; otherwise keep it in Latin script).
- Never translate or alter code, commands, file names, paths, URLs, environment variable names, JSON keys, version numbers, or anything inside backticks or code fences.
- For JSON input: return only JSON with exactly the same structure and keys; translate string values only; keep arrays the same length and order. Return the JSON with no surrounding prose and no code fence.
- For Markdown input: return only the translated Markdown. Keep the YAML front matter keys unchanged and translate the "title" and "description" values. Preserve every heading level, list structure, table layout, link target, image path, HTML tag, admonition syntax and code fence exactly. Translate link text, alt text and headings.
- Keep sentence punctuation conventions of the target language. Keep an ellipsis character where the source uses one.
- Use the right-to-left script naturally for Arabic, Hebrew and Persian; do not add directional marks.`;

function userPrompt(unit, locale) {
  const l = getLocale(locale);
  return `Target language: ${l.label} (${langTag(locale)}).\n\n${unit.kind === 'json' ? 'JSON to translate:' : 'Markdown to translate:'}\n\n${unit.source}`;
}

function requestParams(unit, locale) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: userPrompt(unit, locale) }],
  };
}

// ---------- validation ----------

function sameShape(a, b) {
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => sameShape(v, b[i]));
  if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && sameShape(a[k], b[k]));
  }
  return typeof a === typeof b;
}

const fences = (md) => (md.match(/^```/gm) || []).length;
const linkTargets = (md) => (md.match(/\]\(([^)\s]+)\)/g) || []).sort().join('\n');
const headingCount = (md) => (md.match(/^#{1,6}\s/gm) || []).length;
const frontmatterKeys = (md) => {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return m ? (m[1].match(/^\w+(?=:)/gm) || []).sort().join(',') : '';
};

function stripFence(text) {
  const m = text.trim().match(/^```(?:json|markdown|md)?\n([\s\S]*?)\n```$/);
  return m ? m[1] : text.trim();
}

function validate(unit, text) {
  const body = stripFence(text);
  if (unit.kind === 'json') {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      return { ok: false, reason: `not JSON (${err.message})` };
    }
    if (!sameShape(JSON.parse(unit.source), parsed)) return { ok: false, reason: 'JSON shape differs from source' };
    return { ok: true, value: parsed };
  }
  if (fences(body) !== fences(unit.source)) return { ok: false, reason: 'code fence count differs' };
  if (linkTargets(body) !== linkTargets(unit.source)) return { ok: false, reason: 'link targets differ' };
  if (headingCount(body) !== headingCount(unit.source)) return { ok: false, reason: 'heading count differs' };
  if (frontmatterKeys(body) !== frontmatterKeys(unit.source)) return { ok: false, reason: 'front matter keys differ' };
  return { ok: true, value: `${body.trimEnd()}\n` };
}

// ---------- writing ----------

function writeResult(unit, locale, value, manifest) {
  if (unit.id.startsWith('marketing:')) {
    const p = join(i18nDir, `${locale}.json`);
    const current = readJson(p, {});
    current[unit.key] = value;
    const en = readJson(join(i18nDir, 'en.json'));
    const ordered = {};
    for (const k of Object.keys(en)) if (k in current) ordered[k] = current[k];
    writeJson(p, ordered);
  } else if (unit.id === 'sidebar') {
    const p = join(i18nDir, 'sidebar.translations.json');
    const current = readJson(p, {});
    for (const [group, label] of Object.entries(value)) current[group] = { ...(current[group] || {}), [locale]: label };
    writeJson(p, current);
  } else {
    const dir = join(site, 'src', 'content', 'docs', locale, 'docs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${unit.slug}.md`), value);
  }
  manifest[locale] ||= {};
  manifest[locale][unit.id] = sha(unit.source);
}

// ---------- main ----------

async function main() {
  const manifest = readJson(manifestPath, {});
  const units = collectUnits();
  const byId = new Map(units.map((u) => [u.id, u]));
  const jobs = [];
  for (const l of targets) {
    for (const u of units) {
      if (manifest[l.code]?.[u.id] === sha(u.source)) continue;
      jobs.push({ custom_id: `${l.code}::${u.id}`, locale: l.code, unit: u });
    }
  }

  const chars = jobs.reduce((n, j) => n + j.unit.source.length, 0);
  const estIn = Math.round((chars / 4 + 900 * jobs.length) / 1000); // + system prompt per request (mostly cached)
  const estOut = Math.round(((chars / 4) * 1.25) / 1000);
  console.log(
    `translate: ${units.length} units × ${targets.length} locales → ${jobs.length} jobs pending (${units.length * targets.length - jobs.length} up to date).`
  );
  console.log(
    `translate: ≈${estIn}k input + ≈${estOut}k output tokens, ≈$${((estIn * PRICE_IN + estOut * PRICE_OUT) / 1000).toFixed(2)} at Batch API rates.`
  );
  if (dryRun) {
    for (const j of jobs.slice(0, 15)) console.log(`  ${j.custom_id} (${j.unit.source.length} chars)`);
    if (jobs.length > 15) console.log(`  … ${jobs.length - 15} more`);
    return;
  }
  if (!jobs.length && !resume) return;

  const client = new Anthropic();
  const outcomes = { written: 0, failed: [] };
  const handle = (customId, message) => {
    const [locale, unitId] = customId.split('::');
    const unit = byId.get(unitId);
    if (!unit) return outcomes.failed.push(`${customId}: unknown unit`);
    if (message.stop_reason !== 'end_turn')
      return outcomes.failed.push(`${customId}: stop_reason ${message.stop_reason}`);
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const v = validate(unit, text);
    if (!v.ok) return outcomes.failed.push(`${customId}: ${v.reason}`);
    writeResult(unit, locale, v.value, manifest);
    outcomes.written++;
  };

  if (syncMode) {
    for (const j of jobs) {
      process.stdout.write(`  ${j.custom_id} … `);
      try {
        const message = await client.messages.create(requestParams(j.unit, j.locale));
        handle(j.custom_id, message);
        console.log('ok');
      } catch (err) {
        outcomes.failed.push(`${j.custom_id}: ${err.message}`);
        console.log('failed');
      }
      writeJson(manifestPath, manifest);
    }
  } else {
    let batchId = resume;
    if (!batchId) {
      const batch = await client.messages.batches.create({
        requests: jobs.map((j) => ({ custom_id: j.custom_id, params: requestParams(j.unit, j.locale) })),
      });
      batchId = batch.id;
      writeJson(batchStatePath, { id: batchId, createdAt: new Date().toISOString(), jobs: jobs.length });
      console.log(
        `translate: batch ${batchId} submitted (${jobs.length} requests). Resume with --resume=${batchId} if interrupted.`
      );
    }
    for (;;) {
      const batch = await client.messages.batches.retrieve(batchId);
      if (batch.processing_status === 'ended') break;
      console.log(
        `translate: ${batch.processing_status}, ${batch.request_counts.processing} processing, ${batch.request_counts.succeeded} done…`
      );
      await new Promise((r) => setTimeout(r, 60_000));
    }
    for await (const result of await client.messages.batches.results(batchId)) {
      if (result.result.type === 'succeeded') handle(result.custom_id, result.result.message);
      else
        outcomes.failed.push(
          `${result.custom_id}: ${result.result.type}${result.result.error ? ` (${JSON.stringify(result.result.error)})` : ''}`
        );
    }
    writeJson(manifestPath, manifest);
  }

  console.log(`translate: ${outcomes.written} translation(s) written.`);
  if (outcomes.failed.length) {
    console.error(
      `translate: ${outcomes.failed.length} failed (re-run to retry only these):\n  ${outcomes.failed.join('\n  ')}`
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`translate: ${err.message}`);
  process.exit(1);
});
