// CHANGELOG.md as data: one entry per "## [x.y.z] - YYYY-MM-DD" section, for the
// Atom feed (src/pages/changelog.xml.js) and llms-full.txt. The /changelog/ page
// renders the whole file through Astro's own Markdown instead.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './repoRoot.js';

const FILE = join(REPO_ROOT, 'CHANGELOG.md');
const REPO = 'https://github.com/anefzaoui/minecraft-server-manager';

/** @returns {{ version: string, date: string, markdown: string, anchor: string }[]} newest first */
export function releases() {
  const md = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
  const out = [];
  const re = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm;
  const heads = [...md.matchAll(re)];
  heads.forEach((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : md.length;
    const body = md
      .slice(m.index + m[0].length, end)
      // Link reference definitions at the bottom of the file are not content.
      .replace(/^\[[^\]]+\]:\s+\S+\s*$/gm, '')
      .trim();
    // The same anchor GitHub and Astro give "## [0.14.1] - 2026-09-21".
    const anchor = `${m[1]}---${m[2]}`.replace(/\./g, '');
    out.push({ version: m[1], date: m[2], markdown: body, anchor });
  });
  return out;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,:;]|$)/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_m, label, url) =>
        `<a href="${url.startsWith('http') ? url : `${REPO}/blob/main/${url.replace(/^\.?\//, '')}`}">${label}</a>`
    )
    .replace(/(^|[\s(])#(\d+)\b/g, `$1<a href="${REPO}/issues/$2">#$2</a>`);
}

/**
 * The small Markdown subset CHANGELOG.md uses (### headings, paragraphs, "-"
 * lists with wrapped lines, code spans, bold, links, #issue numbers) as HTML.
 */
export function toHtml(md) {
  const blocks = md.split(/\n{2,}/);
  const html = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (/^#{3,6}\s/.test(lines[0])) {
      html.push(`<h3>${inline(lines[0].replace(/^#+\s*/, ''))}</h3>`);
      if (lines.length > 1) html.push(toHtml(lines.slice(1).join('\n')));
      continue;
    }
    if (/^\s*[-*]\s/.test(lines[0])) {
      const items = [];
      for (const line of lines) {
        if (/^\s*[-*]\s/.test(line)) items.push(line.replace(/^\s*[-*]\s+/, ''));
        else if (items.length) items[items.length - 1] += ` ${line.trim()}`;
      }
      html.push(`<ul>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^```/.test(lines[0])) {
      html.push(
        `<pre><code>${esc(lines.slice(1, lines.at(-1)?.startsWith('```') ? -1 : undefined).join('\n'))}</code></pre>`
      );
      continue;
    }
    html.push(`<p>${inline(lines.map((l) => l.trim()).join(' '))}</p>`);
  }
  return html.join('\n');
}
