// Copies the repo's docs/*.md into the site's Starlight content collection.
//
// The English docs are single-sourced in ../docs (what GitHub renders). This
// script derives the site copies from them on every dev/build, so the two can
// never drift: it adds the frontmatter Starlight needs, drops the H1 (Starlight
// renders the title itself), and rewrites GitHub-relative links into site URLs.
// Output is gitignored (src/content/docs/docs/ + public/docs/{images,screenshots}/).
// Screenshots are copied as PNG (for the dev server) and as WebP; after a build,
// src/lib/doc-images.js points the pages at the WebP, gives every one its width
// and height, and drops the PNGs from dist/.
//
// Translated docs are NOT produced here: scripts/translate.js writes those to
// src/content/docs/<lang>/docs/ and they are committed.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const docsDir = join(repoRoot, 'docs');
const outDir = join(here, '..', 'src', 'content', 'docs', 'docs');
const publicDocs = join(here, '..', 'public', 'docs');
// Both image folders the docs link to, copied as-is.
const IMAGE_DIRS = ['images', 'screenshots'];
const generatedDir = join(here, '..', 'src', 'generated');

const GITHUB_BLOB = 'https://github.com/anefzaoui/minecraft-server-manager/blob/main/';

/** Map a GitHub-relative link target to a site URL. Exported for translate.js. */
export function rewriteTarget(target) {
  if (/^(https?:|mailto:|#)/.test(target)) return target;
  const [path, hash = ''] = target.split('#');
  const anchor = hash ? `#${hash}` : '';
  if (path.startsWith('images/') || path.startsWith('screenshots/')) return `/docs/${path}`;
  if (path === 'README.md') return `/docs/${anchor}`;
  if (/^[\w-]+\.md$/.test(path)) return `/docs/${path.slice(0, -3)}/${anchor}`;
  if (path.startsWith('../')) return `${GITHUB_BLOB}${path.slice(3)}${anchor}`;
  return target;
}

/** Rewrite every markdown link/image and raw <img src> in a doc body. */
export function rewriteLinks(md) {
  return md
    .replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (_m, open, target, close) => `${open}${rewriteTarget(target)}${close}`)
    .replace(/(<img\b[^>]*\ssrc=")([^"]+)(")/g, (_m, open, target, close) => `${open}${rewriteTarget(target)}${close}`);
}

/** Split a GitHub doc into { title, body } (H1 becomes the title). */
export function splitDoc(md) {
  const m = md.match(/^#\s+(.+?)\s*\n/);
  if (!m) throw new Error('Doc has no H1 title.');
  return { title: m[1].trim(), body: md.slice(m[0].length).replace(/^\s+/, '') };
}

export function toStarlight(md, { slug }) {
  const { title, body } = splitDoc(md);
  const fm = [
    '---',
    `title: ${JSON.stringify(slug === 'index' ? 'Documentation' : title)}`,
    `description: ${JSON.stringify(describe(body))}`,
    // Keep GitHub as the canonical "edit" location for every doc page.
    `editUrl: ${JSON.stringify(`${GITHUB_BLOB.replace('/blob/', '/edit/')}docs/${slug === 'index' ? 'README' : slug}.md`)}`,
    '---',
    '',
  ].join('\n');
  return `${fm}${rewriteLinks(body.replace(/<!--\s*description:[\s\S]*?-->\s*/, ''))}`;
}

// The search description of a doc page. A doc can set it explicitly with an
// HTML comment (invisible on GitHub) anywhere in the file:
//   <!-- description: How much memory a Minecraft server needs, by player count. -->
// Otherwise it is the opening of the first real paragraph: whole sentences
// until there are at least 70 characters, capped at 160.
export function describe(body) {
  const explicit = body.match(/<!--\s*description:\s*([\s\S]*?)\s*-->/);
  if (explicit) return explicit[1].replace(/\s+/g, ' ').trim();
  return firstParagraphSentences(body);
}

function firstParagraphSentences(body) {
  // First real paragraph: skip images, HTML, headings, tables, lists, quotes,
  // and navigation lines such as "[← Back to docs index](README.md)".
  const lines = body.split('\n');
  const isProse = (l) => {
    const t = l.trim();
    return (
      t && !/^[!<#|>*-]/.test(t) && !/^\d+\./.test(t) && !/^\[?[←→]/.test(t) && !/^\[[^\]]*\]\([^)]*\)\s*$/.test(t)
    );
  };
  const start = lines.findIndex(isProse);
  if (start === -1) return '';
  const para = [];
  for (let i = start; i < lines.length && lines[i].trim(); i++) para.push(lines[i].trim());
  const plain = para
    .join(' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
  // A sentence ends at . ! ? followed by a space and a capital (so "Node.js" and
  // ".zip" do not split).
  const sentences = plain.split(/(?<=[.!?:])\s+(?=[A-Z"(])/);
  let out = '';
  for (const sentence of sentences) {
    const next = (out + ' ' + sentence.trim()).trim();
    if (next.length > 160) break;
    out = next;
    if (out.length >= 70) break;
  }
  return out || plain.slice(0, 157).replace(/\s+\S*$/, '') + '…';
}

export function sync() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  let count = 0;
  for (const file of readdirSync(docsDir)) {
    if (!file.endsWith('.md')) continue;
    const slug = file === 'README.md' ? 'index' : file.slice(0, -3);
    const md = readFileSync(join(docsDir, file), 'utf8');
    writeFileSync(join(outDir, `${slug}.md`), toStarlight(md, { slug }));
    count++;
  }
  // CHANGELOG.md feeds the /changelog/ page. Drop its H1 (the page has its own)
  // and turn the version headings into anchors GitHub also understands.
  mkdirSync(generatedDir, { recursive: true });
  const changelog = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8').replace(/^#\s+Changelog\s*\n/, '');
  writeFileSync(join(generatedDir, 'changelog.md'), changelog);
  return count;
}

/** Largest WebP edge: twice the docs column, and under WebP's 16383 px limit. */
export const WEBP_MAX_WIDTH = 1600;
const WEBP_MAX_HEIGHT = 16383;

/** Size of the WebP a docs screenshot becomes, from its PNG's size. */
export function webpSize(width, height) {
  const scale = Math.min(1, WEBP_MAX_WIDTH / width, WEBP_MAX_HEIGHT / height);
  return [Math.round(width * scale), Math.round(height * scale)];
}

/** PNG width and height from its IHDR chunk. */
export function pngSize(file) {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function filesUnder(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) filesUnder(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * docs/images and docs/screenshots into public/docs, as is, plus a WebP of each
 * PNG (quality 82, at most WEBP_MAX_WIDTH wide). A WebP newer than its
 * PNG is kept, so a rebuild converts only what changed.
 */
export async function syncImages() {
  const { default: sharp } = await import('sharp');
  let converted = 0;
  let kept = 0;
  const wanted = new Set();
  for (const dir of IMAGE_DIRS) {
    for (const src of filesUnder(join(docsDir, dir))) {
      const rel = src.slice(docsDir.length + 1);
      const isPng = rel.endsWith('.png');
      const copy = join(publicDocs, rel);
      const out = isPng ? copy.replace(/\.png$/, '.webp') : copy;
      wanted.add(copy);
      wanted.add(out);
      mkdirSync(dirname(out), { recursive: true });
      if (!existsSync(copy) || statSync(copy).mtimeMs < statSync(src).mtimeMs) copyFileSync(src, copy);
      if (!isPng) continue;
      if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) {
        kept++;
        continue;
      }
      const [w, h] = webpSize(...pngSize(src));
      await sharp(src, { limitInputPixels: false }).resize(w, h).webp({ quality: 82, effort: 5 }).toFile(out);
      converted++;
    }
  }
  // Drop what no longer has a source (a renamed or deleted screenshot).
  if (existsSync(publicDocs)) for (const f of filesUnder(publicDocs)) if (!wanted.has(f)) rmSync(f);
  return { converted, kept };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = sync();
  const { converted, kept } = await syncImages();
  console.log(
    `sync-docs: ${n} docs copied to src/content/docs/docs/; images to public/docs/ (${converted} converted to WebP, ${kept} unchanged).`
  );
}
