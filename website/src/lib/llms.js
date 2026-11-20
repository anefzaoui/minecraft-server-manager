// llms.txt and llms-full.txt (https://llmstxt.org): what Minecraft Server
// Manager is, in plain Markdown, for AI assistants and search tools. Built from
// the same sources as the pages (en.json, docs/*.md, CHANGELOG.md), so they
// never say something the site does not.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getCopy } from '../i18n/index.js';
import { PAGES, HUBS, SITE_URL } from './routes.js';
import { releases } from './changelog.js';
import { splitDoc, describe, rewriteLinks } from '../../scripts/sync-docs.js';
import head from '../data/llms-head.md?raw';
import pkg from '../../../package.json';

import { REPO_ROOT } from './repoRoot.js';

const docsDir = join(REPO_ROOT, 'docs');
// Maintainer-only pages stay out of the summary for assistants.
const SKIP = new Set(['website.md']);

/** Every docs page: slug, title, description, Markdown body with site links. */
export function docs() {
  return readdirSync(docsDir)
    .filter((f) => f.endsWith('.md') && !SKIP.has(f))
    .sort((a, b) => (a === 'README.md' ? -1 : b === 'README.md' ? 1 : a.localeCompare(b)))
    .map((file) => {
      const md = readFileSync(join(docsDir, file), 'utf8').replace(/\r\n/g, '\n');
      const { title, body } = splitDoc(md);
      const slug = file === 'README.md' ? '' : `${file.slice(0, -3)}/`;
      const clean = rewriteLinks(body.replace(/<!--[\s\S]*?-->\s*/g, ''))
        .replace(/\]\(\/(?!\/)/g, `](${SITE_URL}/`)
        // The site serves docs screenshots as WebP (src/lib/doc-images.js).
        .replace(/(\/docs\/(?:images|screenshots)\/[^)\s"]+)\.png/g, '$1.webp');
      return { url: `${SITE_URL}/docs/${slug}`, title, description: describe(body), body: clean };
    });
}

const abs = (path) => new URL(path, SITE_URL).href;

export function llmsTxt() {
  const copy = getCopy('en');
  const lines = [head.trim().replace('{{version}}', pkg.version), '', '## Pages', ''];
  for (const p of PAGES) {
    if (p.key === 'home' || p.key === 'docs') continue;
    const hub = HUBS.find((h) => h.id === p.key);
    const meta = hub ? copy[hub.hubKey].meta : copy.meta[p.key];
    lines.push(`- [${meta.title}](${abs(p.path)}): ${meta.description}`);
  }
  for (const hub of HUBS) {
    lines.push('', `## ${copy[hub.hubKey].title}`, '');
    for (const page of hub.pages) {
      const c = copy[page.key];
      lines.push(`- [${c.title}](${abs(`/${hub.id}/${page.slug}/`)}): ${c.meta.description}`);
    }
  }
  lines.push('', '## Documentation', '');
  for (const d of docs()) lines.push(`- [${d.title}](${d.url}): ${d.description}`);
  lines.push(
    '',
    '## Optional',
    '',
    `- [Everything above in one file](${SITE_URL}/llms-full.txt): the documentation, the questions and answers and the latest release notes, as Markdown`,
    `- [Release feed](${SITE_URL}/changelog.xml): Atom feed of every release`,
    '- [Source code](https://github.com/anefzaoui/minecraft-server-manager)',
    ''
  );
  return lines.join('\n');
}

export function llmsFullTxt() {
  const copy = getCopy('en');
  const parts = [head.trim().replace('{{version}}', pkg.version)];
  parts.push(
    '## Questions and answers',
    copy.faq.items.map((f) => `### ${f.q}\n\n${f.a}${f.pills?.length ? ` (${f.pills.join(', ')})` : ''}`).join('\n\n')
  );
  for (const d of docs()) parts.push(`# ${d.title}\n\nSource: ${d.url}\n\n${d.body.trim()}`);
  const recent = releases().slice(0, 3);
  parts.push(
    `# Latest releases\n\nSource: ${SITE_URL}/changelog/\n\n${recent.map((r) => `## ${r.version} (${r.date})\n\n${r.markdown}`).join('\n\n')}`
  );
  return `${parts.join('\n\n')}\n`;
}
