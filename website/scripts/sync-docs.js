// Copies the repo's docs/*.md into the site's Starlight content collection.
//
// The English docs are single-sourced in ../docs (what GitHub renders). This
// script derives the site copies from them on every dev/build, so the two can
// never drift: it adds the frontmatter Starlight needs, drops the H1 (Starlight
// renders the title itself), and rewrites GitHub-relative links into site URLs.
// Output is gitignored (src/content/docs/docs/ + public/docs/{images,screenshots}/).
//
// Translated docs are NOT produced here: scripts/translate.js writes those to
// src/content/docs/<lang>/docs/ and they are committed.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    `description: ${JSON.stringify(firstSentence(body))}`,
    // Keep GitHub as the canonical "edit" location for every doc page.
    `editUrl: ${JSON.stringify(`${GITHUB_BLOB.replace('/blob/', '/edit/')}docs/${slug === 'index' ? 'README' : slug}.md`)}`,
    '---',
    '',
  ].join('\n');
  return `${fm}${rewriteLinks(body)}`;
}

function firstSentence(body) {
  // First real paragraph line: skip images, HTML, headings, tables, and
  // navigation lines such as "[← Back to docs index](README.md)".
  const text = body.split('\n').find((l) => {
    const t = l.trim();
    return t && !/^[!<#|>-]/.test(t) && !/^\[?[←→]/.test(t) && !/^\[[^\]]*\]\([^)]*\)\s*$/.test(t);
  });
  const plain = (text || '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
  const m = plain.match(/^(.{20,155}?[.!?])(\s|$)/);
  return (m ? m[1] : plain.slice(0, 155)).trim();
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
  rmSync(publicDocs, { recursive: true, force: true });
  for (const dir of IMAGE_DIRS) cpSync(join(docsDir, dir), join(publicDocs, dir), { recursive: true });
  // CHANGELOG.md feeds the /changelog/ page. Drop its H1 (the page has its own)
  // and turn the version headings into anchors GitHub also understands.
  mkdirSync(generatedDir, { recursive: true });
  const changelog = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8').replace(/^#\s+Changelog\s*\n/, '');
  writeFileSync(join(generatedDir, 'changelog.md'), changelog);
  return count;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = sync();
  console.log(`sync-docs: ${n} docs copied to src/content/docs/docs/, images to public/docs/.`);
}
