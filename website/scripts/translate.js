// Translates the site's English source (marketing copy, docs sidebar labels, and
// the synced English docs) into every locale in src/i18n/locales.js, writing the
// results next to the source so they are committed and the build stays offline.
//
//   pnpm run translate --dry-run            # what would be sent, and the cost estimate
//   pnpm run translate                      # translate everything pending (8 in flight)
//   pnpm run translate --locales=ar,fr      # subset of locales
//   pnpm run translate --only=marketing     # marketing | sidebar | docs
//   pnpm run translate --model=<id>         # any OpenRouter chat model (default: Gemini Flash Lite)
//
// Incremental by construction: src/i18n/translation-manifest.json records the
// sha256 of the English text each translation was made from, and a unit is only
// re-sent when its source hash changed. Deterministic checks (same JSON shape,
// same code fences, same link targets) guard every result before it is written.
//
// Provider: OpenRouter's OpenAI-compatible chat completions with
// google/gemini-2.5-flash-lite by default (≈$0.10 / $0.40 per million tokens; a unit
// that fails validation or the token cap is retried on the bigger models;
// the whole site is under a dollar). Key: OPENROUTER_API_KEY in website/.env.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, DEFAULT_LOCALE, getLocale, langTag } from '../src/i18n/locales.js';
import { SIDEBAR_LABELS } from '../src/i18n/sidebar.js';
import { sync as syncDocs } from './sync-docs.js';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
try {
  process.loadEnvFile(join(site, '.env'));
} catch {
  /* key may come from the environment */
}
const i18nDir = join(site, 'src', 'i18n');
const docsEnDir = join(site, 'src', 'content', 'docs', 'docs');
const manifestPath = join(i18nDir, 'translation-manifest.json');

// Contributor-facing docs stay English: the wide tables in website.md make every
// model loop until the token cap, and its readers are maintainers.
const UNTRANSLATED_DOCS = ['website'];
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const FALLBACK_MODELS = ['google/gemini-2.5-flash', 'google/gemini-3.1-flash-lite'];
const MAX_TOKENS = 16000;
const CONCURRENCY = 8;
// USD per million tokens for the default model, for the dry-run estimate.
const PRICE_IN = 0.1;
const PRICE_OUT = 0.4;

const args = new Map(process.argv.slice(2).map((a) => (a.includes('=') ? a.split(/=(.*)/s).slice(0, 2) : [a, true])));
const dryRun = args.has('--dry-run');
const only = args.get('--only') || 'all';
const MODEL = typeof args.get('--model') === 'string' ? args.get('--model') : DEFAULT_MODEL;
const wantedLocales = typeof args.get('--locales') === 'string' ? args.get('--locales').split(',') : null;

const targets = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).filter(
  (l) => !wantedLocales || wantedLocales.includes(l.code)
);

const sha = (s) => createHash('sha256').update(s).digest('hex');
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const writeJson = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

// ---------- units ----------

/**
 * One front matter value: written as a JSON string by this script and by
 * sync-docs.js, but Prettier (singleQuote) rewrites committed files to YAML
 * single quotes, where '' stands for one quote. Plain scalars pass through.
 */
function yamlScalar(raw) {
  const v = raw.trim();
  if (v.startsWith('"')) return JSON.parse(v);
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

function splitFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: md, raw: '' };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = yamlScalar(kv[2]);
  }
  return { meta, body: md.slice(m[0].length), raw: m[1] };
}

const UNTRANSLATABLE_KEYS = new Set(['pills', 'icon', 'reqPills']);

/** Deep copy without the untranslatable keys. */
function stripUntranslatable(v) {
  if (Array.isArray(v)) return v.map(stripUntranslatable);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) if (!UNTRANSLATABLE_KEYS.has(k)) out[k] = stripUntranslatable(val);
    return out;
  }
  return v;
}

/** Put the untranslatable keys from `en` back into the translated `t` (same shape). */
function restoreUntranslatable(en, t) {
  if (Array.isArray(en)) return en.map((v, i) => restoreUntranslatable(v, t[i]));
  if (en && typeof en === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(en))
      out[k] = UNTRANSLATABLE_KEYS.has(k) ? val : restoreUntranslatable(val, t[k]);
    return out;
  }
  return t;
}

function collectUnits() {
  const units = [];
  if (only === 'all' || only === 'marketing') {
    const en = readJson(join(i18nDir, 'en.json'));
    for (const [key, value] of Object.entries(en)) {
      if (key === '$comment') continue;
      // A bare string is wrapped so the model always sees (and returns) an object.
      const wrapped = typeof value === 'string' ? { text: value } : stripUntranslatable(value);
      units.push({
        id: `marketing:${key}`,
        full: value,
        kind: 'json',
        source: JSON.stringify(wrapped, null, 2),
        key,
        unwrap: typeof value === 'string',
      });
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
      const slug = file.slice(0, -3);
      if (UNTRANSLATED_DOCS.includes(slug)) continue;
      const { meta, body } = splitFrontMatter(readFileSync(join(docsEnDir, file), 'utf8'));
      // The front matter goes as a tiny JSON unit of its own: sent inline with the
      // markdown, the model rewrites it as a ```json block and breaks the file.
      units.push({
        id: `docs-meta:${slug}`,
        kind: 'json',
        source: JSON.stringify({ title: meta.title, description: meta.description }, null, 2),
        slug,
        editUrl: meta.editUrl,
      });
      units.push({ id: `docs:${slug}`, kind: 'markdown', source: body, slug });
    }
  }
  return units;
}

const SYSTEM = `You translate the website of Minecraft Server Manager, a free self-hosted control panel for Minecraft servers that run in Docker containers. Translate into the requested language for a technical but general audience: natural, idiomatic, concise, no machine-translation stiffness.

Rules:
- Keep product and proper names untranslated: Minecraft, Mojang, Docker, Java, RCON, Modrinth, CurseForge, Hangar, SpigotMC, GitHub, Discord, BlueMap, Fabric, Forge, NeoForge, Quilt, Paper, Purpur, Bedrock, Geyser, Floodgate, Node.js, pnpm, itzg, mclo.gs, Minecraft Server Manager (you may transliterate the product name only if that is standard in the target language; otherwise keep it in Latin script).
- Never translate or alter code, commands, file names, paths, URLs, environment variable names, JSON keys, version numbers, or anything inside backticks or code fences.
- For JSON input: return only JSON with exactly the same structure and keys; translate string values only; keep arrays the same length and order. Return the JSON with no surrounding prose and no code fence.
- For Markdown input: return only the translated Markdown, starting with its first line (no code fence around the whole document). Preserve every heading level, list structure, table layout, link target, image path, HTML tag, admonition syntax and code fence exactly. Translate link text, alt text and headings.
- Keep sentence punctuation conventions of the target language. Keep an ellipsis character where the source uses one.
- Use the right-to-left script naturally for Arabic, Hebrew and Persian; do not add directional marks.`;

function userPrompt(unit, locale) {
  const l = getLocale(locale);
  return `Target language: ${l.label} (${langTag(locale)}).\n\n${unit.kind === 'json' ? 'JSON to translate:' : 'Markdown to translate:'}\n\n${unit.source}`;
}

function requestBody(unit, locale) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userPrompt(unit, locale) },
    ],
  };
}

const KEY = process.env.OPENROUTER_API_KEY;

/** One chat completion through OpenRouter, with retries on 429/5xx. */
async function complete(body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://minecraft-server-manager.com',
        'X-Title': 'MSM website translations',
      },
      body: JSON.stringify({ ...body, usage: { include: true } }),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error(`no choice: ${JSON.stringify(data).slice(0, 200)}`);
    return { text: choice.message?.content || '', finish: choice.finish_reason, cost: data.usage?.cost || 0 };
  }
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
  let repaired = body;
  if (linkTargets(body) !== linkTargets(unit.source)) {
    // Same number of links: the model altered targets (anchors, encoding). Put
    // the source targets back in order; the link text stays translated.
    const src = unit.source.match(/\]\(([^)\s]+)\)/g) || [];
    const out = body.match(/\]\(([^)\s]+)\)/g) || [];
    if (src.length !== out.length) return { ok: false, reason: 'link targets differ' };
    let i = 0;
    repaired = body.replace(/\]\(([^)\s]+)\)/g, () => src[i++]);
  }
  if (headingCount(body) !== headingCount(unit.source)) return { ok: false, reason: 'heading count differs' };
  return { ok: true, value: `${repaired.trimEnd()}\n` };
}

// ---------- writing ----------

const docsMetaPath = (locale) => join(i18nDir, 'docs-meta', `${locale}.json`);

function frontMatter(slug, locale, editUrl) {
  const meta = readJson(docsMetaPath(locale), {})[slug];
  const en = splitFrontMatter(readFileSync(join(docsEnDir, `${slug}.md`), 'utf8')).meta;
  const title = meta?.title || en.title;
  const description = meta?.description || en.description;
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\neditUrl: ${JSON.stringify(editUrl || en.editUrl)}\n---\n`;
}

function writeResult(unit, locale, value, manifest) {
  if (unit.id.startsWith('marketing:')) {
    const p = join(i18nDir, `${locale}.json`);
    const current = readJson(p, {});
    current[unit.key] = unit.unwrap ? value.text : restoreUntranslatable(unit.full, value);
    const en = readJson(join(i18nDir, 'en.json'));
    const ordered = {};
    for (const k of Object.keys(en)) if (k in current) ordered[k] = current[k];
    writeJson(p, ordered);
  } else if (unit.id === 'sidebar') {
    const p = join(i18nDir, 'sidebar.translations.json');
    const current = readJson(p, {});
    for (const [group, label] of Object.entries(value)) current[group] = { ...(current[group] || {}), [locale]: label };
    writeJson(p, current);
  } else if (unit.id.startsWith('docs-meta:')) {
    mkdirSync(join(i18nDir, 'docs-meta'), { recursive: true });
    const all = readJson(docsMetaPath(locale), {});
    all[unit.slug] = value;
    writeJson(docsMetaPath(locale), all);
    // Refresh the front matter of an already-translated body.
    const file = join(site, 'src', 'content', 'docs', locale, 'docs', `${unit.slug}.md`);
    if (existsSync(file)) {
      const { body } = splitFrontMatter(readFileSync(file, 'utf8'));
      writeFileSync(file, frontMatter(unit.slug, locale, unit.editUrl) + body);
    }
  } else {
    const dir = join(site, 'src', 'content', 'docs', locale, 'docs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${unit.slug}.md`), frontMatter(unit.slug, locale) + value);
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
    `translate: ≈${estIn}k input + ≈${estOut}k output tokens, ≈$${((estIn * PRICE_IN + estOut * PRICE_OUT) / 1000).toFixed(2)} at OpenRouter rates for the default model.`
  );
  if (dryRun) {
    for (const j of jobs.slice(0, 15)) console.log(`  ${j.custom_id} (${j.unit.source.length} chars)`);
    if (jobs.length > 15) console.log(`  … ${jobs.length - 15} more`);
    return;
  }
  if (!jobs.length) return;

  if (!KEY) {
    console.error('translate: OPENROUTER_API_KEY is not set (website/.env).');
    process.exit(1);
  }
  const outcomes = { written: 0, failed: [], cost: 0 };
  // Returns null on success, else the reason. Writing happens here.
  const handle = (job, text, finish) => {
    if (finish && finish !== 'stop') return `finish_reason ${finish}`;
    const v = validate(job.unit, text);
    if (!v.ok) return v.reason;
    writeResult(job.unit, job.locale, v.value, manifest);
    outcomes.written++;
    return null;
  };

  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        // Default model first; any failure (validation or token cap) retries on
        // the bigger models. A pair that fails the same way every time on Flash
        // Lite almost always passes on Flash.
        let reason = null;
        for (const model of [MODEL, ...FALLBACK_MODELS]) {
          const res = await complete({ ...requestBody(job.unit, job.locale), model });
          outcomes.cost += res.cost;
          reason = handle(job, res.text, res.finish);
          if (!reason) break;
        }
        if (reason) outcomes.failed.push(`${job.custom_id}: ${reason}`);
      } catch (err) {
        outcomes.failed.push(`${job.custom_id}: ${err.message}`);
      }
      done++;
      if (done % 25 === 0 || done === jobs.length) {
        writeJson(manifestPath, manifest);
        console.log(
          `translate: ${done}/${jobs.length} done, ${outcomes.failed.length} failed, $${outcomes.cost.toFixed(3)} so far.`
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  writeJson(manifestPath, manifest);

  console.log(`translate: ${outcomes.written} translation(s) written, reported cost $${outcomes.cost.toFixed(3)}.`);
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
