// Post-build checks over dist/. Plain, deterministic code: every HTML page must
// carry a canonical URL, a full hreflang set, the right lang/dir, parseable
// JSON-LD, a social card image that exists, and no internal link that points at
// a path the build did not emit. English pages also need a unique title of at
// most 70 characters and a description of at most 170.
// Exits non-zero on the first category of failure so CI blocks the deploy.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, DEFAULT_LOCALE, langTag, getLocale } from '../src/i18n/locales.js';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
const SITE = 'https://minecraft-server-manager.com';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const failures = [];
const fail = (file, msg) => failures.push(`${file.replace(dist, '')}: ${msg}`);

for (const f of [
  'robots.txt',
  'CNAME',
  'sitemap-index.xml',
  'sitemap-0.xml',
  '404.html',
  'og/home.png',
  'site.webmanifest',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-512.png',
]) {
  if (!existsSync(join(dist, f))) failures.push(`missing ${f}`);
}
if (
  existsSync(join(dist, 'robots.txt')) &&
  !readFileSync(join(dist, 'robots.txt'), 'utf8').includes(`${SITE}/sitemap-index.xml`)
) {
  failures.push('robots.txt does not reference the sitemap');
}

const pages = walk(dist);
const emitted = new Set(
  pages.map((p) =>
    p
      .replace(dist, '')
      .replace(/index\.html$/, '')
      .replace(/\\/g, '/')
  )
);
let marketing = 0;
let docs = 0;
const englishTitles = new Map();
const attr = (html, re) =>
  html
    .match(re)?.[1]
    ?.replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const rel = file.replace(dist, '').replace(/\\/g, '/');
  const isDocs = /^\/(?:[a-z-]+\/)?docs\//.test(rel);
  const first = rel.split('/')[1];
  const locale = LOCALES.some((l) => l.code === first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
  const info = getLocale(locale);

  const htmlTag = html.match(/<html[^>]*>/)?.[0] || '';
  if (!htmlTag.includes(`lang="${langTag(locale)}"`)) fail(file, `expected lang="${langTag(locale)}" in ${htmlTag}`);
  if (!htmlTag.includes(`dir="${info.dir}"`)) fail(file, `expected dir="${info.dir}"`);

  if (rel !== '/404.html') {
    if (!/<link rel="canonical" href="https:\/\/minecraft-server-manager\.com\//.test(html)) fail(file, 'no canonical');
    const alternates = html.match(/<link rel="alternate" hreflang="[^"]+"/g) || [];
    // Marketing pages list every locale + x-default; Starlight docs pages list the locales that exist.
    if (!isDocs && alternates.length !== LOCALES.length + 1)
      fail(file, `expected ${LOCALES.length + 1} hreflang links, got ${alternates.length}`);
    if (isDocs && alternates.length < 2) fail(file, `docs page has ${alternates.length} hreflang links`);
    if (!html.includes('<meta property="og:image"')) fail(file, 'no og:image');
    if (!html.includes('<meta name="description"')) fail(file, 'no meta description');
    if (!/<title>[^<]+<\/title>/.test(html)) fail(file, 'no title');

    const card = html.match(
      /<meta property="og:image" content="https:\/\/minecraft-server-manager\.com(\/[^"]+)"/
    )?.[1];
    if (card && !existsSync(join(dist, card))) fail(file, `og:image ${card} was not built`);

    if (locale === DEFAULT_LOCALE) {
      const title = attr(html, /<title>([^<]+)<\/title>/) || '';
      const description = attr(html, /<meta name="description" content="([^"]*)"/) || '';
      if (title.length > 70) fail(file, `title is ${title.length} characters (max 70): ${title}`);
      if (description.length > 170) fail(file, `description is ${description.length} characters (max 170)`);
      if (englishTitles.has(title)) fail(file, `same title as ${englishTitles.get(title)}`);
      englishTitles.set(title, rel);
    }
  }

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (err) {
      fail(file, `invalid JSON-LD: ${err.message}`);
    }
  }

  for (const m of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) {
    const target = m[1];
    if (target.startsWith('/_astro/') || target.startsWith('/pagefind/')) continue;
    const asDir = target.endsWith('/') ? target : `${target}/`;
    if (emitted.has(asDir) || existsSync(join(dist, target))) continue;
    fail(file, `broken internal link ${target}`);
  }

  if (isDocs) docs++;
  else marketing++;
}

const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
const urls = sitemap.match(/<loc>/g)?.length || 0;
if (urls !== pages.length - 1)
  failures.push(`sitemap lists ${urls} urls but ${pages.length - 1} indexable pages were built`);
if (!sitemap.includes('hreflang="x-default"') && !sitemap.includes('hreflang="en"'))
  failures.push('sitemap has no hreflang alternates');

console.log(
  `verify-dist: ${pages.length} pages (${marketing} marketing, ${docs} docs), ${urls} sitemap urls, ${LOCALES.length} locales.`
);
if (failures.length) {
  const shown = failures.slice(0, 40);
  console.error(
    `verify-dist: ${failures.length} failure(s)\n  ${shown.join('\n  ')}${failures.length > shown.length ? '\n  …' : ''}`
  );
  process.exit(1);
}
console.log('verify-dist: OK');
