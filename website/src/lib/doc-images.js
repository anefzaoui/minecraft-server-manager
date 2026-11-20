// Astro integration, after the build: every docs screenshot (an <img> of
// /docs/images/*.png or /docs/screenshots/*.png, in any language) is pointed at
// the WebP scripts/sync-docs.js made of it and given its width and height, so
// nothing shifts while it loads; the first one on a page loads eagerly (it may
// be the largest paint), the rest lazily. The PNG copies, there for the dev
// server, are then dropped from dist/. A post-build pass rather than a Markdown
// plugin, because the translated docs are committed Markdown too and Astro 7's
// default Markdown processor takes no rehype plugins.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from './repoRoot.js';
import { pngSize, webpSize } from '../../scripts/sync-docs.js';

const IMG = /<img\b[^>]*\ssrc="\/docs\/((?:images|screenshots)\/[^"]+)\.png"[^>]*>/g;

function files(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Rewrites one page's HTML; sizeOf(path) gives the WebP's [width, height] or null. */
export function rewrite(html, sizeOf) {
  let first = true;
  return html.replace(IMG, (tag, path) => {
    const size = sizeOf(path);
    if (!size) return tag;
    const [w, h] = size;
    const given = Number(tag.match(/\swidth="(\d+)"/)?.[1]) || 0;
    const width = given || w;
    const height = Math.round((h * width) / w);
    const out = tag
      .replace(`src="/docs/${path}.png"`, `src="/docs/${path}.webp"`)
      .replace(/\s(?:width|height|loading|decoding)="[^"]*"/g, '')
      .replace(
        /^<img/,
        `<img width="${width}" height="${height}" loading="${first ? 'eager' : 'lazy'}" decoding="async"`
      );
    first = false;
    return out;
  });
}

export default function docImages() {
  return {
    name: 'msm-doc-images',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const sizes = new Map();
        const sizeOf = (path) => {
          if (!sizes.has(path)) {
            const png = join(REPO_ROOT, 'docs', `${path}.png`);
            const ok = existsSync(png) && existsSync(join(dist, 'docs', `${path}.webp`));
            sizes.set(path, ok ? webpSize(...pngSize(png)) : null);
          }
          return sizes.get(path);
        };
        let pages = 0;
        for (const file of files(dist, '.html')) {
          const html = readFileSync(file, 'utf8');
          if (!html.includes('/docs/images/') && !html.includes('/docs/screenshots/')) continue;
          const next = rewrite(html, sizeOf);
          if (next !== html) {
            writeFileSync(file, next);
            pages++;
          }
        }
        let dropped = 0;
        for (const sub of ['images', 'screenshots']) {
          const d = join(dist, 'docs', sub);
          if (!existsSync(d)) continue;
          for (const png of files(d, '.png')) {
            rmSync(png);
            dropped++;
          }
        }
        logger.info(`${pages} pages point at WebP screenshots with their sizes; ${dropped} PNG copies dropped.`);
      },
    },
  };
}
