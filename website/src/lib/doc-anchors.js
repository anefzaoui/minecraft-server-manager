// Astro integration, after the build: a translated docs page keeps the English
// anchors. Its headings are translated, so their ids are too, but links inside
// the docs (and links from other sites, and the English llms.txt) point at the
// English ids, such as /fr/docs/updates/#changing-the-mod-loader-version. The
// translator keeps the same headings in the same order (scripts/translate.js
// checks it), so the n-th heading of a translation gets an empty anchor with
// the id of the n-th English heading, placed just before it.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, DEFAULT_LOCALE } from '../i18n/locales.js';

const HEADING = /<div class="sl-heading-wrapper level-h[2-6]"><h([2-6]) id="([^"]+)"/g;

const headings = (html) => [...html.matchAll(HEADING)].map((m) => ({ level: m[1], id: m[2], index: m.index }));

/** Adds the English ids to one translated page. Exported for testing. */
export function addAliases(translated, english) {
  const en = headings(english);
  const tr = headings(translated);
  if (en.length !== tr.length || en.some((h, i) => h.level !== tr[i].level))
    return { html: translated, added: 0, skipped: true };
  const have = new Set([...translated.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  let out = translated;
  let added = 0;
  // From the end, so earlier offsets stay valid.
  for (let i = tr.length - 1; i >= 0; i--) {
    const id = en[i].id;
    if (id === tr[i].id || have.has(id)) continue;
    out = `${out.slice(0, tr[i].index)}<span id="${id}" class="anchor-alias"></span>${out.slice(tr[i].index)}`;
    added++;
  }
  return { html: out, added, skipped: false };
}

export default function docAnchors() {
  return {
    name: 'msm-doc-anchors',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const enDocs = join(dist, 'docs');
        let pages = 0;
        let anchors = 0;
        const skipped = [];
        for (const { code } of LOCALES) {
          if (code === DEFAULT_LOCALE) continue;
          const root = join(dist, code, 'docs');
          if (!existsSync(root)) continue;
          const walk = (d, rel) => {
            for (const name of readdirSync(d)) {
              const p = join(d, name);
              if (statSync(p).isDirectory()) walk(p, `${rel}${name}/`);
              else if (name === 'index.html') {
                const en = join(enDocs, rel, 'index.html');
                if (!existsSync(en)) continue;
                const html = readFileSync(p, 'utf8');
                const r = addAliases(html, readFileSync(en, 'utf8'));
                if (r.skipped) skipped.push(`/${code}/docs/${rel}`);
                if (r.added) {
                  writeFileSync(p, r.html);
                  pages++;
                  anchors += r.added;
                }
              }
            }
          };
          walk(root, '');
        }
        logger.info(`${anchors} English anchors kept on ${pages} translated docs pages.`);
        if (skipped.length) logger.warn(`Headings differ from English, no anchors added: ${skipped.join(', ')}`);
      },
    },
  };
}
