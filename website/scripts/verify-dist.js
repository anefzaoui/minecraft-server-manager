// Post-build checks over dist/. Plain, deterministic code that fails the build
// (exit 1) on anything a search engine, a social card or a reader would trip on:
//
// - Files: robots.txt (with the sitemap), CNAME, sitemaps, 404, icons, the
//   release feed, llms.txt and llms-full.txt; social cards are 1200x630 PNGs.
// - Every page: lang/dir, a non-empty <title> and meta description, unique
//   within its language; English titles at most 70 characters, descriptions
//   50 to 170; a canonical URL that is the page itself; Open Graph and Twitter
//   tags; exactly one <h1>; a <main> landmark; every <img> with an alt
//   attribute and its width and height (no layout shift).
// - hreflang: every page lists itself, x-default, and only pages that exist,
//   and every alternate lists it back (reciprocity). Marketing pages list
//   every locale.
// - JSON-LD: parses, has @context and @type, carries the fields each type
//   needs (SoftwareApplication, FAQPage, HowTo, BreadcrumbList, ...), and every
//   URL in it that points at this site exists.
// - Links: every internal link and image points at a file the build emitted,
//   and every #anchor exists on the page it points at.
// - Sitemap: every page except the 404 is listed once, every <loc> exists,
//   and its hreflang alternates are reciprocal too.
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
const fail = (where, msg) => failures.push(`${where}: ${msg}`);
const decode = (s = '') =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}(?:=(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?(?=[\\s/>])`, 'i'));
  if (!m) return undefined;
  return decode(m[1] ?? m[2] ?? m[3] ?? '');
};

// ---------------------------------------------------------------- files
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
  'changelog.xml',
  'llms.txt',
  'llms-full.txt',
]) {
  if (!existsSync(join(dist, f))) failures.push(`missing ${f}`);
}
if (
  existsSync(join(dist, 'robots.txt')) &&
  !readFileSync(join(dist, 'robots.txt'), 'utf8').includes(`${SITE}/sitemap-index.xml`)
)
  failures.push('robots.txt does not reference the sitemap');

// ---------------------------------------------------------------- page index
const files = walk(dist);
const pathOf = (file) =>
  file
    .replace(dist, '')
    .replace(/\\/g, '/')
    .replace(/index\.html$/, '');
/** URL path ('/fr/docs/') -> dist file */
const byPath = new Map(files.map((f) => [pathOf(f), f]));
const fileFor = (p) => byPath.get(p) || byPath.get(p.endsWith('/') ? p : `${p}/`);
// Every file in dist/, by its exact URL path. Looked up here rather than with
// existsSync, which ignores case on Windows and macOS: a link to /pt-BR/ must
// fail locally just as it 404s on GitHub Pages.
const everyFile = new Set();
(function all(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) all(p);
    else everyFile.add(p.replace(dist, '').replace(/\\/g, '/'));
  }
})(dist);
const exists = (p) => {
  const clean = decodeURI(p.split('#')[0].split('?')[0]);
  return Boolean(fileFor(clean)) || everyFile.has(clean);
};
const htmlCache = new Map();
const html = (file) => {
  if (!htmlCache.has(file)) htmlCache.set(file, readFileSync(file, 'utf8'));
  return htmlCache.get(file);
};
const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const ids = new Set();
    for (const m of html(file).matchAll(/\s(?:id|name)="([^"]+)"/g)) ids.add(decode(m[1]));
    idCache.set(file, ids);
  }
  return idCache.get(file);
}
/** Path of a site URL or absolute path, or null when it is not this site. */
const sitePath = (url) =>
  url.startsWith(SITE) ? url.slice(SITE.length) || '/' : url.startsWith('/') && !url.startsWith('//') ? url : null;

// ---------------------------------------------------------------- JSON-LD
const LD_REQUIRED = {
  WebSite: ['name', 'url'],
  Organization: ['name', 'url', 'logo'],
  SoftwareApplication: ['name', 'applicationCategory', 'operatingSystem', 'softwareVersion', 'offers'],
  FAQPage: ['mainEntity'],
  HowTo: ['name', 'step'],
  BreadcrumbList: ['itemListElement'],
  ItemList: ['itemListElement'],
  TechArticle: ['headline', 'url', 'image', 'author', 'publisher'],
};
let ldObjects = 0;
const ldTypes = new Map();

function checkLd(where, obj) {
  ldObjects++;
  if (obj['@context'] !== 'https://schema.org') fail(where, `JSON-LD without @context https://schema.org`);
  const type = obj['@type'];
  if (!type) return fail(where, 'JSON-LD without @type');
  ldTypes.set(type, (ldTypes.get(type) || 0) + 1);
  for (const key of LD_REQUIRED[type] || []) {
    const v = obj[key];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0))
      fail(where, `${type} JSON-LD lacks ${key}`);
  }
  if (type === 'SoftwareApplication') {
    if (String(obj.offers?.price) !== '0') fail(where, 'SoftwareApplication offers.price is not 0');
    if (!obj.offers?.priceCurrency) fail(where, 'SoftwareApplication offers lacks priceCurrency');
    if (!/^\d+\.\d+\.\d+/.test(obj.softwareVersion || ''))
      fail(where, `softwareVersion "${obj.softwareVersion}" is not a version`);
  }
  if (type === 'FAQPage')
    for (const q of obj.mainEntity || [])
      if (q['@type'] !== 'Question' || !q.name || q.acceptedAnswer?.['@type'] !== 'Answer' || !q.acceptedAnswer.text)
        fail(where, 'FAQPage question malformed');
  if (type === 'HowTo')
    for (const s of obj.step || [])
      if (s['@type'] !== 'HowToStep' || !s.text) fail(where, 'HowTo step without @type HowToStep and text');
  if (type === 'BreadcrumbList' || type === 'ItemList')
    (obj.itemListElement || []).forEach((it, i) => {
      if (it['@type'] !== 'ListItem' || it.position !== i + 1)
        fail(where, `${type} item has the wrong @type or position`);
      if (!it.name) fail(where, `${type} item has no name`);
      if (!(it.item || it.url)) fail(where, `${type} item has no URL`);
    });
  // Every URL in it that points at this site must exist.
  const walkLd = (v) => {
    if (typeof v === 'string') {
      const p = v.startsWith(SITE) ? sitePath(v) : null;
      if (p && !exists(p)) fail(where, `JSON-LD links to ${v}, which was not built`);
    } else if (Array.isArray(v)) v.forEach(walkLd);
    else if (v && typeof v === 'object') Object.values(v).forEach(walkLd);
  };
  walkLd(obj);
}

// ---------------------------------------------------------------- per page
let marketing = 0;
let docs = 0;
let images = 0;
let anchors = 0;
const titles = new Map(); // `${locale}\n${title}` -> rel
const descriptions = new Map();
/** rel -> Map(hreflang -> href) */
const alternatesOf = new Map();

for (const file of files) {
  const page = html(file);
  const rel = pathOf(file);
  const isDocs = /^\/(?:[a-z-]+\/)?docs\//.test(rel);
  const first = rel.split('/')[1];
  const locale = LOCALES.some((l) => l.code === first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
  const info = getLocale(locale);
  const is404 = rel === '/404.html';

  const htmlTag = page.match(/<html[^>]*>/)?.[0] || '';
  if (!htmlTag.includes(`lang="${langTag(locale)}"`)) fail(rel, `expected lang="${langTag(locale)}" in ${htmlTag}`);
  if (!htmlTag.includes(`dir="${info.dir}"`)) fail(rel, `expected dir="${info.dir}"`);

  // Landmarks and headings.
  const h1s = page.match(/<h1[\s>]/g)?.length || 0;
  if (h1s !== 1) fail(rel, `${h1s} <h1> elements (want exactly one)`);
  if (!/<main[\s>]/.test(page)) fail(rel, 'no <main> landmark');

  // Images: alt always (empty for decoration), width and height always.
  for (const m of page.matchAll(/<img\b[^>]*>/g)) {
    images++;
    const tag = m[0];
    if (attr(tag, 'alt') === undefined) fail(rel, `<img> without alt: ${tag.slice(0, 100)}`);
    if (!attr(tag, 'width') || !attr(tag, 'height')) fail(rel, `<img> without width and height: ${tag.slice(0, 100)}`);
  }

  if (!is404) {
    const title = decode(page.match(/<title>([^<]*)<\/title>/)?.[1] || '').trim();
    const description = decode(page.match(/<meta name="description" content="([^"]*)"/)?.[1] || '').trim();
    if (!title) fail(rel, 'no title');
    if (!description) fail(rel, 'no meta description');
    if (/noindex/.test(page.match(/<meta name="robots"[^>]*>/)?.[0] || '')) fail(rel, 'indexable page carries noindex');
    if (locale === DEFAULT_LOCALE) {
      if (title.length > 70) fail(rel, `title is ${title.length} characters (max 70): ${title}`);
      if (description.length > 170) fail(rel, `description is ${description.length} characters (max 170)`);
      if (description.length < 50) fail(rel, `description is only ${description.length} characters: ${description}`);
    }
    const tKey = `${locale}\n${title}`;
    if (titles.has(tKey)) fail(rel, `same title as ${titles.get(tKey)}: ${title}`);
    titles.set(tKey, rel);
    const dKey = `${locale}\n${description}`;
    if (descriptions.has(dKey)) fail(rel, `same description as ${descriptions.get(dKey)}`);
    descriptions.set(dKey, rel);

    const canonical = page.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) fail(rel, 'no canonical');
    else if (canonical !== `${SITE}${rel}`) fail(rel, `canonical ${canonical} is not this page`);

    for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type'])
      if (!page.includes(`<meta property="${tag}"`)) fail(rel, `no ${tag}`);
    if (!page.includes('<meta name="twitter:card" content="summary_large_image"')) fail(rel, 'no twitter:card');
    const card = page.match(
      /<meta property="og:image" content="https:\/\/minecraft-server-manager\.com(\/[^"]+)"/
    )?.[1];
    if (card && !everyFile.has(card)) fail(rel, `og:image ${card} was not built`);

    const alts = new Map();
    for (const m of page.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
      if (alts.has(m[1])) fail(rel, `hreflang ${m[1]} listed twice`);
      alts.set(m[1], m[2]);
    }
    alternatesOf.set(rel, alts);
    if (!isDocs && alts.size !== LOCALES.length + 1)
      fail(rel, `expected ${LOCALES.length + 1} hreflang links, got ${alts.size}`);
    if (!alts.has('x-default')) fail(rel, 'no hreflang x-default');
    if (alts.get(langTag(locale)) !== `${SITE}${rel}`)
      fail(rel, `hreflang ${langTag(locale)} does not point at the page itself`);
  }

  for (const m of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let obj;
    try {
      obj = JSON.parse(m[1]);
    } catch (err) {
      fail(rel, `invalid JSON-LD: ${err.message}`);
      continue;
    }
    for (const o of Array.isArray(obj) ? obj : [obj]) checkLd(rel, o);
  }

  // Internal links, images and anchors.
  for (const m of page.matchAll(/\s(href|src)="([^"]*)"/g)) {
    const raw = decode(m[2]);
    let target = null;
    if (raw.startsWith('#')) target = `${rel}${raw}`;
    else if (raw.startsWith(SITE) || (raw.startsWith('/') && !raw.startsWith('//'))) target = sitePath(raw);
    if (!target) continue;
    const [path, hash] = target.split('#');
    if (path.startsWith('/_astro/') || path.startsWith('/pagefind/')) continue;
    if (!exists(path)) {
      fail(rel, `broken internal link ${raw}`);
      continue;
    }
    if (m[1] === 'href' && hash) {
      anchors++;
      const targetFile = fileFor(path);
      if (targetFile && !idsOf(targetFile).has(decodeURIComponent(hash)))
        fail(rel, `anchor #${hash} does not exist on ${path}`);
    }
  }

  if (isDocs) docs++;
  else marketing++;
}

// ---------------------------------------------------------------- hreflang reciprocity
let pairs = 0;
for (const [rel, alts] of alternatesOf) {
  const self = [...alts].find(([, h]) => h === `${SITE}${rel}`)?.[0];
  for (const [lang, href] of alts) {
    const target = sitePath(href);
    if (!target || !exists(target)) {
      fail(rel, `hreflang ${lang} points at ${href}, which was not built`);
      continue;
    }
    if (lang === 'x-default' || target === rel) continue;
    pairs++;
    const back = alternatesOf.get(target);
    if (!back || back.get(self) !== `${SITE}${rel}`) fail(rel, `hreflang ${lang} -> ${target} does not link back`);
  }
}

// ---------------------------------------------------------------- sitemap
const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
const locs = new Map();
for (const m of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
  if (!loc) continue;
  if (locs.has(loc)) failures.push(`sitemap lists ${loc} twice`);
  locs.set(
    loc,
    new Map(
      [...m[1].matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((a) => [a[1], a[2]])
    )
  );
  const p = sitePath(loc);
  if (!p || !exists(p)) failures.push(`sitemap lists ${loc}, which was not built`);
}
for (const rel of alternatesOf.keys()) if (!locs.has(`${SITE}${rel}`)) failures.push(`sitemap misses ${rel}`);
if (locs.size !== alternatesOf.size)
  failures.push(`sitemap lists ${locs.size} urls but ${alternatesOf.size} indexable pages were built`);
let sitemapAlternates = 0;
for (const [loc, alts] of locs) {
  if (alts.size === 0) failures.push(`sitemap entry ${loc} has no hreflang alternates`);
  const self = [...alts].find(([, h]) => h === loc)?.[0];
  for (const [lang, href] of alts) {
    sitemapAlternates++;
    const back = locs.get(href);
    if (!back) failures.push(`sitemap alternate ${lang} of ${loc} is not in the sitemap: ${href}`);
    else if (back.get(self) !== loc) failures.push(`sitemap alternate ${lang} of ${loc} does not link back`);
  }
}

// ---------------------------------------------------------------- feed, llms, cards
if (existsSync(join(dist, 'changelog.xml'))) {
  const feed = readFileSync(join(dist, 'changelog.xml'), 'utf8');
  if (!feed.startsWith('<?xml') || !feed.includes('xmlns="http://www.w3.org/2005/Atom"'))
    failures.push('changelog.xml is not an Atom feed');
  if (!/<entry>/.test(feed)) failures.push('changelog.xml has no entries');
  for (const m of feed.matchAll(/<link rel="alternate" type="text\/html" href="([^"]+)"\/>/g)) {
    const [p, hash] = (sitePath(m[1]) || '').split('#');
    if (!exists(p)) failures.push(`feed links to ${m[1]}, which was not built`);
    else if (hash && !idsOf(fileFor(p)).has(hash)) failures.push(`feed links to #${hash}, which is not on ${p}`);
  }
}
for (const f of ['llms.txt', 'llms-full.txt']) {
  if (!existsSync(join(dist, f))) continue;
  const text = readFileSync(join(dist, f), 'utf8');
  if (!text.startsWith('# Minecraft Server Manager')) failures.push(`${f} does not start with the project's name`);
  for (const m of text.matchAll(/\]\((https:\/\/minecraft-server-manager\.com[^)\s]*)\)/g)) {
    const [p, hash] = sitePath(m[1]).split('#');
    if (!exists(p)) failures.push(`${f} links to ${m[1]}, which was not built`);
    else if (hash && fileFor(p) && !idsOf(fileFor(p)).has(hash)) failures.push(`${f} links to ${m[1]}: no such anchor`);
  }
}
let cards = 0;
function pngSize(file) {
  const b = readFileSync(file);
  return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
}
(function walkCards(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkCards(p);
    else if (name.endsWith('.png')) {
      cards++;
      const size = pngSize(p);
      if (!size || size[0] !== 1200 || size[1] !== 630)
        failures.push(`${p.replace(dist, '')} is ${size ? size.join('x') : 'not a PNG'}, want 1200x630`);
    }
  }
})(join(dist, 'og'));

console.log(
  `verify-dist: ${files.length} pages (${marketing} marketing, ${docs} docs), ${locs.size} sitemap urls with ` +
    `${sitemapAlternates} alternates, ${LOCALES.length} locales, ${pairs} hreflang pairs, ${images} images, ` +
    `${anchors} anchors, ${ldObjects} JSON-LD objects (${[...ldTypes].map(([t, n]) => `${t} ${n}`).join(', ')}), ` +
    `${cards} social cards.`
);
if (failures.length) {
  const kinds = new Map();
  for (const f of failures) {
    const kind = f
      .replace(/^\/[^:]*: /, '')
      .replace(/(https?:\/\/|\/|#)[^\s)]*/g, '…')
      .replace(/\d+/g, 'N')
      .slice(0, 70);
    kinds.set(kind, (kinds.get(kind) || 0) + 1);
  }
  const shown = process.env.VERIFY_ALL ? failures : failures.slice(0, 40);
  console.error(
    `verify-dist: ${failures.length} failure(s)\n  ${shown.join('\n  ')}${failures.length > shown.length ? '\n  …' : ''}` +
      `\n\nBy kind:\n  ${[...kinds]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([k, n]) => `${n}  ${k}`)
        .join('\n  ')}`
  );
  process.exit(1);
}
console.log('verify-dist: OK');
